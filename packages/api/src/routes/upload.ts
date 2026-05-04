import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { v4 as uuid } from "uuid";
import { getAuth } from "@clerk/express";
import { eq, lt } from "drizzle-orm";
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from "@mix-match/shared";
import { db } from "../db/client.js";
import { analyses, users } from "../db/schema.js";
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

const execFileAsync = promisify(execFile);

uploadRouter.post("/upload", upload.single("file"), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  cleanupExpiredChunks().catch((err) => console.error("[cleanup]", err));

  try {
    // Ensure user exists in DB
    if (userId) {
      await db.insert(users).values({ clerkId: userId }).onConflictDoNothing();
    }

    // Check credits
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (user) {
      // Reset credits if period expired
      if (user.creditsResetAt < new Date()) {
        const resetCredits = user.plan === "free" ? 3 : user.plan === "pro" ? 30 : 999;
        await db.update(users).set({
          creditsRemaining: resetCredits,
          creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }).where(eq(users.clerkId, userId));
      } else if (user.creditsRemaining <= 0) {
        res.status(403).json({ error: "No credits remaining. Credits reset on " + user.creditsResetAt.toLocaleDateString() });
        return;
      }

      // Decrement credits
      await db.update(users).set({ creditsRemaining: user.creditsRemaining - 1 }).where(eq(users.clerkId, userId));
    }

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
        userId: userId,
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

uploadRouter.post("/upload-url", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { url, mode: rawMode } = req.body ?? {};
  const mode = rawMode === "detailed" ? "detailed" : "fast";

  if (typeof url !== "string" || !(url.startsWith("http://") || url.startsWith("https://"))) {
    res.status(400).json({ error: "Invalid URL. Must start with http:// or https://" });
    return;
  }

  cleanupExpiredChunks().catch((err) => console.error("[cleanup]", err));

  // Ensure user exists in DB
  await db.insert(users).values({ clerkId: userId }).onConflictDoNothing();

  // Check credits
  const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (user) {
    // Reset credits if period expired
    if (user.creditsResetAt < new Date()) {
      const resetCredits = user.plan === "free" ? 3 : user.plan === "pro" ? 30 : 999;
      await db.update(users).set({
        creditsRemaining: resetCredits,
        creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }).where(eq(users.clerkId, userId));
    } else if (user.creditsRemaining <= 0) {
      res.status(403).json({ error: "No credits remaining. Credits reset on " + user.creditsResetAt.toLocaleDateString() });
      return;
    }

    // Decrement credits
    await db.update(users).set({ creditsRemaining: user.creditsRemaining - 1 }).where(eq(users.clerkId, userId));
  }

  const outputPath = path.join(config.uploadDir, uuid() + ".mp3");

  try {
    // Get video title
    const { stdout: title } = await execFileAsync("yt-dlp", ["--print", "title", url]);
    const filename = title.trim() || "Unknown title";

    // Download audio as mp3
    await execFileAsync("yt-dlp", [
      "-x",
      "--audio-format", "mp3",
      "--max-filesize", "300m",
      "-o", outputPath,
      url,
    ]);

    // SHA256 file hash for full-file cache
    const fileBuffer = await fs.readFile(outputPath);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Check file cache
    const cachedAnalysisId = await redis.get(`acr:file:${fileHash}`);
    if (cachedAnalysisId) {
      await fs.unlink(outputPath).catch(() => {});
      res.json({ analysisId: cachedAnalysisId });
      return;
    }

    // Get file size
    const stat = await fs.stat(outputPath);

    // Create analysis record
    const [analysis] = await db
      .insert(analyses)
      .values({
        filename,
        fileSize: stat.size,
        fileHash,
        status: "pending",
        userId,
      })
      .returning({ id: analyses.id });

    // Enqueue job
    await analysisQueue.add("analyze", {
      analysisId: analysis.id,
      filePath: outputPath,
      fileHash,
      mode,
    });

    res.json({ analysisId: analysis.id });
  } catch (err: any) {
    await fs.unlink(outputPath).catch(() => {});
    if (err?.stderr || err?.message?.includes("yt-dlp")) {
      res.status(400).json({ error: err.stderr?.trim() || err.message });
      return;
    }
    throw err;
  }
});
