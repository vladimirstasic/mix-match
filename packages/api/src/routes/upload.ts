import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs/promises";
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from "@mix-detective/shared";
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

export const uploadRouter = Router();

uploadRouter.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    // SHA256 file hash for full-file cache
    const fileBuffer = await fs.readFile(file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

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
    });

    res.json({ analysisId: analysis.id });
  } catch (err) {
    await fs.unlink(file.path).catch(() => {});
    throw err;
  }
});
