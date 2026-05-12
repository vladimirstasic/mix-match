import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import { eq, lt, and, sql } from 'drizzle-orm';
import { requireUser, getUserId } from '../middleware/auth.js';
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES, PLANS, PLAN_CREDITS, ANALYSIS_MODES } from '@mix-match/shared';
import { db } from '../db/client.js';
import { analyses, users } from '../db/schema.js';
import { findUser } from '../db/helpers.js';
import { analysisQueue } from '../queue/index.js';
import { redis } from '../queue/index.js';
import { config } from '../config.js';

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
    await db.update(analyses).set({ chunksDir: null, chunksExpireAt: null }).where(eq(analyses.id, row.id));
  }
}

async function checkCredits(userId: string, res: import('express').Response): Promise<boolean> {
  const user = await findUser(userId);
  if (user) {
    // Reset credits if period expired
    if (user.creditsResetAt < new Date()) {
      const resetCredits = PLAN_CREDITS[user.plan as keyof typeof PLAN_CREDITS] ?? PLAN_CREDITS[PLANS.FREE];
      await db
        .update(users)
        .set({
          creditsRemaining: resetCredits,
          creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
        .where(eq(users.clerkId, userId));
    }

    // Atomic decrement — returns empty if credits already 0
    const result = await db
      .update(users)
      .set({ creditsRemaining: sql`${users.creditsRemaining} - 1` })
      .where(and(eq(users.clerkId, userId), sql`${users.creditsRemaining} > 0`))
      .returning({ creditsRemaining: users.creditsRemaining });

    if (result.length === 0) {
      res.status(403).json({ error: 'No credits remaining' });
      return false;
    }
  }
  return true;
}

export const uploadRouter = Router();

const execFileAsync = promisify(execFile);

uploadRouter.post('/upload', upload.single('file'), requireUser, async (req, res) => {
  const userId = getUserId(req);
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  cleanupExpiredChunks().catch(err => console.error('[cleanup]', err));

  try {
    // Ensure user exists in DB
    if (userId) {
      await db.insert(users).values({ clerkId: userId }).onConflictDoNothing();
    }

    if (!(await checkCredits(userId, res))) return;

    // SHA256 file hash for full-file cache (streaming to avoid loading entire file into memory)
    const fileHash = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(file.path);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });

    // Mode from form data (default: fast)
    const mode = req.body?.mode === ANALYSIS_MODES.DETAILED ? ANALYSIS_MODES.DETAILED : ANALYSIS_MODES.FAST;

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
        status: 'pending',
        userId: userId,
      })
      .returning({ id: analyses.id });

    // Enqueue job
    await analysisQueue.add('analyze', {
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

uploadRouter.post('/upload-url', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const { url, mode: rawMode } = req.body ?? {};
  const mode = rawMode === ANALYSIS_MODES.DETAILED ? ANALYSIS_MODES.DETAILED : ANALYSIS_MODES.FAST;

  if (typeof url !== 'string' || !(url.startsWith('http://') || url.startsWith('https://'))) {
    res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
    return;
  }

  cleanupExpiredChunks().catch(err => console.error('[cleanup]', err));

  // Ensure user exists in DB
  await db.insert(users).values({ clerkId: userId }).onConflictDoNothing();

  if (!(await checkCredits(userId, res))) return;

  const outputPath = path.join(config.uploadDir, uuid() + '.mp3');

  try {
    const baseYtArgs = [
      '--force-ipv4',
      '--js-runtimes',
      'node',
      '--remote-components',
      'ejs:github',
      '--extractor-args',
      'youtube:player_client=web',
      '--socket-timeout',
      '120',
      '--retries',
      '3',
    ];
    if (process.env.YTDLP_PROXY) {
      baseYtArgs.push('--proxy', process.env.YTDLP_PROXY);
    } else {
      baseYtArgs.push('--proxy', '');
    }

    const maxAttempts = process.env.YTDLP_PROXY ? 5 : 1;
    let filename = 'Unknown title';
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { stdout: title } = await execFileAsync('yt-dlp', [...baseYtArgs, '--print', 'title', url]);
        filename = title.trim() || 'Unknown title';

        await execFileAsync('yt-dlp', [
          ...baseYtArgs,
          '-x',
          '--audio-format',
          'mp3',
          '--max-filesize',
          '300m',
          '-o',
          outputPath,
          url,
        ]);

        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        console.log(`[yt-dlp] Attempt ${attempt}/${maxAttempts} failed: ${err.message?.slice(0, 100)}`);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, attempt * 5000));
        }
      }
    }

    if (lastError) throw lastError;

    // SHA256 file hash for full-file cache (streaming to avoid loading entire file into memory)
    const fileHash = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(outputPath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });

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
        sourceUrl: url,
        status: 'pending',
        userId,
      })
      .returning({ id: analyses.id });

    // Enqueue job
    await analysisQueue.add('analyze', {
      analysisId: analysis.id,
      filePath: outputPath,
      fileHash,
      mode,
    });

    res.json({ analysisId: analysis.id });
  } catch (err: any) {
    await fs.unlink(outputPath).catch(() => {});
    if (err?.stderr || err?.message?.includes('yt-dlp')) {
      res.status(400).json({ error: err.stderr?.trim() || err.message });
      return;
    }
    throw err;
  }
});
