import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { v4 as uuid } from 'uuid';
import { eq, lt, and, sql } from 'drizzle-orm';
import { requireUser, getUserId } from '../middleware/auth.js';
import {
  MAX_FILE_SIZE,
  ALLOWED_MIMETYPES,
  PLANS,
  PLAN_LIMITS,
  ANALYSIS_MODES,
  BETA_SCANS_PER_MONTH,
  BETA_SCANS_PER_DAY,
  FILESCAN_POLL_FALLBACK_DELAY_MS,
} from '@mix-match/shared';
import { db } from '../db/client.js';
import { analyses, users } from '../db/schema.js';
import { findUser, ensureUser } from '../db/helpers.js';
import { analysisQueue } from '../queue/index.js';
import { redis } from '../queue/index.js';
import { filescanPollQueue } from '../queue/filescan-poll.js';
import { config } from '../config.js';
import { normalizeAudio, generateWaveform } from '../services/ffmpeg.js';
import { uploadToFileScan } from '../services/acrcloud-filescan.js';

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

interface PlanCheckInput {
  fileSize?: number;
  mode?: string;
  isYouTube?: boolean;
}

async function checkPlanLimits(
  userId: string,
  res: import('express').Response,
  input: PlanCheckInput,
): Promise<boolean> {
  const adminCheck = await findUser(userId);
  if (adminCheck?.isAdmin) return true;

  if (config.betaMode) {
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `beta:daily:${userId}:${today}`;
    const dailyCount = await redis.incr(dailyKey);
    if (dailyCount === 1) await redis.expire(dailyKey, 86400 * 2);
    if (dailyCount > BETA_SCANS_PER_DAY) {
      res.status(403).json({
        error: `Beta daily limit reached (${BETA_SCANS_PER_DAY} scans/day). Try again tomorrow.`,
        code: 'BETA_DAILY_CAP',
      });
      return false;
    }

    const user = await findUser(userId);
    if (user) {
      if (user.creditsResetAt < new Date()) {
        await db
          .update(users)
          .set({
            creditsRemaining: BETA_SCANS_PER_MONTH,
            creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          })
          .where(eq(users.clerkId, userId));
      }

      const result = await db
        .update(users)
        .set({ creditsRemaining: sql`${users.creditsRemaining} - 1` })
        .where(and(eq(users.clerkId, userId), sql`${users.creditsRemaining} > 0`))
        .returning({ creditsRemaining: users.creditsRemaining });

      if (result.length === 0) {
        await redis.decr(dailyKey);
        res.status(403).json({
          error: `Beta monthly limit reached (${BETA_SCANS_PER_MONTH} scans/month). Subscribe to Pro for unlimited scanning.`,
          code: 'BETA_MONTHLY_CAP',
        });
        return false;
      }
    }

    return true;
  }

  const user = await findUser(userId);
  const planKey = (user?.plan ?? PLANS.FREE) as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[planKey] ?? PLAN_LIMITS[PLANS.FREE];

  if (input.fileSize !== undefined && input.fileSize > limits.maxFileBytes) {
    const maxMb = Math.round(limits.maxFileBytes / 1024 / 1024);
    res.status(403).json({
      error: `File exceeds your plan limit of ${maxMb}MB. Upgrade for larger uploads.`,
      code: 'PLAN_FILE_SIZE',
    });
    return false;
  }

  if (input.mode && !limits.modes.includes(input.mode as 'fast' | 'detailed')) {
    res.status(403).json({
      error: `Detailed mode requires Pro plan or higher.`,
      code: 'PLAN_MODE',
    });
    return false;
  }

  if (input.isYouTube && !limits.youtube) {
    res.status(403).json({
      error: `YouTube links require Pro plan or higher. Use SoundCloud, Mixcloud, or upload a file instead.`,
      code: 'PLAN_YOUTUBE',
    });
    return false;
  }

  if (!user) return true;

  if (user.creditsResetAt < new Date()) {
    await db
      .update(users)
      .set({
        creditsRemaining: limits.scans,
        creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .where(eq(users.clerkId, userId));
  }

  const result = await db
    .update(users)
    .set({ creditsRemaining: sql`${users.creditsRemaining} - 1` })
    .where(and(eq(users.clerkId, userId), sql`${users.creditsRemaining} > 0`))
    .returning({ creditsRemaining: users.creditsRemaining });

  if (result.length === 0) {
    res.status(403).json({ error: 'No scans remaining this month.', code: 'PLAN_SCANS' });
    return false;
  }

  return true;
}

export const uploadRouter = Router();

uploadRouter.post('/upload', upload.single('file'), requireUser, async (req, res) => {
  const userId = getUserId(req);
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  cleanupExpiredChunks().catch(err => console.error('[cleanup]', err));

  try {
    if (userId) {
      await ensureUser(userId);
    }

    const mode = req.body?.mode === ANALYSIS_MODES.DETAILED ? ANALYSIS_MODES.DETAILED : ANALYSIS_MODES.FAST;

    if (!(await checkPlanLimits(userId, res, { fileSize: file.size, mode }))) {
      await fs.unlink(file.path).catch(() => {});
      return;
    }

    const fileHash = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(file.path);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });

    const cachedAnalysisId = await redis.get(`acr:file:${fileHash}`);
    if (cachedAnalysisId) {
      await fs.unlink(file.path);
      res.json({ analysisId: cachedAnalysisId });
      return;
    }

    const requestedEngine = req.query.engine === 'filescan' ? 'filescan' : 'realtime';
    const isAdmin = userId ? (await findUser(userId))?.isAdmin : false;
    const engine = requestedEngine === 'filescan' && isAdmin ? 'filescan' : 'realtime';

    if (engine === 'filescan') {
      if (!config.acrcloud.filescan.bearerToken) {
        await fs.unlink(file.path).catch(() => {});
        res.status(400).json({ error: 'File Scanning engine is not configured (missing ACRCLOUD_CONSOLE_TOKEN).' });
        return;
      }

      const [analysis] = await db
        .insert(analyses)
        .values({
          filename: file.originalname,
          fileSize: file.size,
          fileHash,
          status: 'pending',
          userId,
          engine: 'filescan',
        })
        .returning({ id: analyses.id });

      try {
        const workDir = path.join(config.uploadDir, analysis.id);
        const wavPath = path.join(workDir, 'normalized.wav');
        await fs.mkdir(workDir, { recursive: true });
        await normalizeAudio(file.path, wavPath);
        const waveformData = await generateWaveform(wavPath);
        await fs.unlink(wavPath).catch(() => {});

        const { fileId, state } = await uploadToFileScan(file.path, file.originalname);

        await db
          .update(analyses)
          .set({
            status: 'processing',
            waveformData,
            filescanFileId: fileId,
            scanState: state,
            updatedAt: new Date(),
          })
          .where(eq(analyses.id, analysis.id));

        await filescanPollQueue.add(
          'poll-filescan',
          { analysisId: analysis.id, attempt: 1 },
          { delay: FILESCAN_POLL_FALLBACK_DELAY_MS },
        );

        await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
        await fs.unlink(file.path).catch(() => {});

        res.json({ analysisId: analysis.id });
      } catch (err) {
        await db
          .update(analyses)
          .set({ status: 'failed', error: err instanceof Error ? err.message : String(err), updatedAt: new Date() })
          .where(eq(analyses.id, analysis.id));
        await fs.unlink(file.path).catch(() => {});
        res.json({ analysisId: analysis.id });
      }
      return;
    }

    const [analysis] = await db
      .insert(analyses)
      .values({
        filename: file.originalname,
        fileSize: file.size,
        fileHash,
        status: 'pending',
        userId,
      })
      .returning({ id: analyses.id });

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

  if (/(?:youtube\.com|youtu\.be)/i.test(url)) {
    res.status(400).json({
      error: 'YouTube is still in Beta. Try SoundCloud, Mixcloud, or upload an MP3 directly.',
      code: 'YOUTUBE_NOT_SUPPORTED',
    });
    return;
  }

  cleanupExpiredChunks().catch(err => console.error('[cleanup]', err));

  await ensureUser(userId);

  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url);

  if (!(await checkPlanLimits(userId, res, { mode, isYouTube }))) return;

  const [analysis] = await db
    .insert(analyses)
    .values({
      filename: 'Downloading...',
      fileSize: 0,
      sourceUrl: url,
      status: 'pending',
      userId,
    })
    .returning({ id: analyses.id });

  await analysisQueue.add('download-and-analyze', {
    analysisId: analysis.id,
    url,
    mode,
  });

  res.json({ analysisId: analysis.id });
});
