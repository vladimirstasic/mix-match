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
  BETA_SCANS_PER_MONTH,
  BETA_SCANS_PER_DAY,
  FILESCAN_POLL_FALLBACK_DELAY_MS,
} from '@mix-match/shared';
import { db } from '../db/client.js';
import { analyses, segments, users } from '../db/schema.js';
import { findUser, ensureUser, findAnalysis, getAnalysisSegments } from '../db/helpers.js';
import { analysisQueue } from '../queue/index.js';
import { redis } from '../queue/index.js';
import { filescanPollQueue } from '../queue/filescan-poll.js';
import { config } from '../config.js';
import { normalizeAudio, generateWaveform } from '../services/ffmpeg.js';
import { uploadToFileScan, uploadPlatformUrlToFileScan } from '../services/acrcloud-filescan.js';
import { getVideoTitle } from '../services/ytdlp.js';

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

// A cache hit on somebody else's scan can't just hand over their analysis id — the
// ownership check in GET /analysis/:id would 403 the requester, who then polls a
// spinner forever. Copy the finished result into a row of their own instead, which
// costs zero ACRCloud calls.
//
// chunksDir is deliberately not copied: those files belong to the source analysis and
// are deleted with it, so a clone behaves like any scan whose chunks have expired
// (retry-unknown returns 410). slug/isPublic/isFavorite/tags/isBookmarked stay behind
// too — those are the original owner's, not the requester's.
async function cloneAnalysisForUser(
  source: typeof analyses.$inferSelect,
  userId: string,
  filename: string,
  fileSize: number,
): Promise<string> {
  const [clone] = await db
    .insert(analyses)
    .values({
      filename,
      fileSize,
      fileHash: source.fileHash,
      status: 'completed',
      totalChunks: source.totalChunks,
      processedChunks: source.processedChunks,
      results: source.results,
      metrics: source.metrics,
      waveformData: source.waveformData,
      summary: source.summary,
      userId,
    })
    .returning({ id: analyses.id });

  const sourceSegments = await getAnalysisSegments(source.id);
  if (sourceSegments.length > 0) {
    await db.insert(segments).values(
      sourceSegments.map(s => ({
        analysisId: clone.id,
        startSec: s.startSec,
        endSec: s.endSec,
        status: s.status,
        trackName: s.trackName,
        artist: s.artist,
        title: s.title,
        acrid: s.acrid,
        confidence: s.confidence,
        bpm: s.bpm,
        genre: s.genre,
        musicalKey: s.musicalKey,
        externalLinks: s.externalLinks,
        attempts: s.attempts,
      })),
    );
  }

  return clone.id;
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

    if (!(await checkPlanLimits(userId, res, { fileSize: file.size }))) {
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

    const requestedEngine = req.query.engine === 'filescan' ? 'filescan' : 'realtime';
    const isAdmin = userId ? (await findUser(userId))?.isAdmin : false;
    const engine = requestedEngine === 'filescan' && isAdmin ? 'filescan' : 'realtime';

    // Cache dedup only applies to the realtime engine, whose worker populates this key on
    // completion. File Scanning never writes it, so a prior realtime (or filescan) scan of the
    // same file must not short-circuit a fresh filescan request.
    if (engine === 'realtime') {
      const cachedAnalysisId = await redis.get(`acr:file:${fileHash}`);
      const cached = cachedAnalysisId ? await findAnalysis(cachedAnalysisId) : null;

      // Only a completed row is worth reusing. A cached id whose analysis was since
      // deleted (or is still running) would hand the client something that 404s or
      // never finishes, so fall through to a fresh scan instead.
      if (cached && cached.status === 'completed') {
        await fs.unlink(file.path);
        const analysisId =
          cached.userId === userId
            ? cached.id
            : await cloneAnalysisForUser(cached, userId, file.originalname, file.size);
        res.json({ analysisId });
        return;
      }
    }

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

        console.log(`[upload:filescan] multer reported file.size=${file.size} for "${file.originalname}"`);
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
    });

    res.json({ analysisId: analysis.id });
  } catch (err) {
    await fs.unlink(file.path).catch(() => {});
    throw err;
  }
});

uploadRouter.post('/upload-url', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const { url } = req.body ?? {};

  if (typeof url !== 'string' || !(url.startsWith('http://') || url.startsWith('https://'))) {
    res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
    return;
  }

  const requestedEngine = req.query.engine === 'filescan' ? 'filescan' : 'realtime';
  const isAdmin = (await findUser(userId))?.isAdmin;
  const engine = requestedEngine === 'filescan' && isAdmin ? 'filescan' : 'realtime';
  const isPlatformUrl = /(?:youtube\.com|youtu\.be|twitter\.com|x\.com|tiktok\.com|vimeo\.com)/i.test(url);
  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url);

  // Realtime YouTube stays blocked (yt-dlp path is Beta-gated); File Scanning's own YouTube
  // support goes through ACRCloud's platforms API instead, so it's exempt from this block.
  if (isYouTube && engine !== 'filescan') {
    res.status(400).json({
      error: 'YouTube is still in Beta. Try SoundCloud, Mixcloud, or upload an MP3 directly.',
      code: 'YOUTUBE_NOT_SUPPORTED',
    });
    return;
  }

  cleanupExpiredChunks().catch(err => console.error('[cleanup]', err));

  await ensureUser(userId);

  if (!(await checkPlanLimits(userId, res, { isYouTube }))) return;

  if (engine === 'filescan' && isPlatformUrl) {
    if (!config.acrcloud.filescan.bearerToken) {
      res.status(400).json({ error: 'File Scanning engine is not configured (missing ACRCLOUD_CONSOLE_TOKEN).' });
      return;
    }

    const title = await getVideoTitle(url).catch(() => url);

    const [analysis] = await db
      .insert(analyses)
      .values({ filename: title, fileSize: 0, sourceUrl: url, status: 'pending', userId, engine: 'filescan' })
      .returning({ id: analyses.id });

    try {
      const { fileId, state } = await uploadPlatformUrlToFileScan(url);

      await db
        .update(analyses)
        .set({ status: 'processing', filescanFileId: fileId, scanState: state, updatedAt: new Date() })
        .where(eq(analyses.id, analysis.id));

      await filescanPollQueue.add(
        'poll-filescan',
        { analysisId: analysis.id, attempt: 1 },
        { delay: FILESCAN_POLL_FALLBACK_DELAY_MS },
      );
    } catch (err) {
      await db
        .update(analyses)
        .set({ status: 'failed', error: err instanceof Error ? err.message : String(err), updatedAt: new Date() })
        .where(eq(analyses.id, analysis.id));
    }

    res.json({ analysisId: analysis.id });
    return;
  }

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
  });

  res.json({ analysisId: analysis.id });
});
