import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { eq, lt } from "drizzle-orm";
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from "@mix-match/shared";
import { db } from "../db/client.js";
import { analyses } from "../db/schema.js";
import { analysisQueue } from "../queue/index.js";
import { redis } from "../queue/index.js";
import { config } from "../config.js";

const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

async function cleanupExpiredChunks() {
  const expired = await db
    .select({ id: analyses.id, chunksDir: analyses.chunksDir })
    .from(analyses)
    .where(lt(analyses.chunksExpireAt, new Date()));

  for (const row of expired) {
    if (row.chunksDir) {
      await fs.rm(row.chunksDir, { recursive: true, force: true }).catch(() => {});
      const parentDir = path.dirname(row.chunksDir);
      await fs.rmdir(parentDir).catch(() => {});
    }
    await db.update(analyses)
      .set({ chunksDir: null, chunksExpireAt: null })
      .where(eq(analyses.id, row.id));
  }
}

export const uploadRouter = Router();

uploadRouter.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  cleanupExpiredChunks().catch((err) => console.error("[cleanup]", err));

  try {
    // SHA256 file hash for full-file cache
    const fileBuffer = await fs.readFile(file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Mode from form data (default: fast)
    const mode = req.body?.mode === "detailed" ? "detailed" : "fast";

    // Check file cache
    const cachedAnalysisId = await redis.get(`acr:file:${fileHash}`);
    if (cachedAnalysisId) {
      await fs.unlink(file.path);
      res.json({ analysisId: cachedAnalysisId });
      return;
    }

    // Create analysis record
    const [analysis] = await db
      .insert(analyses)
      .values({
        filename: file.originalname,
        fileSize: file.size,
        fileHash,
        status: "pending",
      })
      .returning({ id: analyses.id });

    // Enqueue job
    await analysisQueue.add("analyze", {
      analysisId: analysis.id,
      filePath: file.path,
      fileHash,
      mode,
    });

    res.json({ analysisId: analysis.id });
  } catch (err) {
    await fs.unlink(file.path).catch(() => {});
    throw err;
  }
});
