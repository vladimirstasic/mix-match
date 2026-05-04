import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { requireUser, getUserId } from '../middleware/auth.js';
import fs from 'fs/promises';
import { db } from '../db/client.js';
import { segments } from '../db/schema.js';
import { findAnalysis } from '../db/helpers.js';
import { retryQueue } from '../queue/index.js';

export const retryRouter = Router();

retryRouter.post('/analysis/:id/segments/:segmentId/retry', requireUser, async (req, res) => {
  const userId = getUserId(req);
  const id = req.params.id as string;
  const segmentId = req.params.segmentId as string;

  const analysis = await findAnalysis(id);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  if (!analysis.chunksDir) {
    res.status(410).json({ error: 'Chunk files not available' });
    return;
  }
  try {
    await fs.access(analysis.chunksDir);
  } catch {
    res.status(410).json({ error: 'Chunk files expired' });
    return;
  }

  const [segment] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, segmentId), eq(segments.analysisId, id)))
    .limit(1);
  if (!segment) {
    res.status(404).json({ error: 'Segment not found' });
    return;
  }

  await db.update(segments).set({ status: 'retrying', updatedAt: new Date() }).where(eq(segments.id, segmentId));

  const job = await retryQueue.add('retry-segment', {
    analysisId: id,
    segmentId,
    startSec: segment.startSec,
    endSec: segment.endSec,
    chunksDir: analysis.chunksDir,
    attempt: segment.attempts + 1,
  });

  res.json({ jobId: job.id });
});

retryRouter.post('/analysis/:id/retry-unknown', requireUser, async (req, res) => {
  const userId = getUserId(req);
  const id = req.params.id as string;

  const analysis = await findAnalysis(id);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }
  if (!analysis.chunksDir) {
    res.status(410).json({ error: 'Chunk files not available' });
    return;
  }
  try {
    await fs.access(analysis.chunksDir);
  } catch {
    res.status(410).json({ error: 'Chunk files expired' });
    return;
  }

  const unknownSegments = await db
    .select()
    .from(segments)
    .where(and(eq(segments.analysisId, id), eq(segments.status, 'unknown')));

  if (unknownSegments.length === 0) {
    res.json({ message: 'No unknown segments' });
    return;
  }

  for (const seg of unknownSegments) {
    await db.update(segments).set({ status: 'retrying', updatedAt: new Date() }).where(eq(segments.id, seg.id));
  }

  const job = await retryQueue.add('retry-all-unknown', {
    analysisId: id,
    segments: unknownSegments.map(s => ({
      segmentId: s.id,
      startSec: s.startSec,
      endSec: s.endSec,
      attempt: s.attempts + 1,
    })),
    chunksDir: analysis.chunksDir,
  });

  res.json({ jobId: job.id, segmentCount: unknownSegments.length });
});
