import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { redis } from "../queue";
import { db } from "../db/client.js";
import { segments } from "../db/schema.js";
import { identifyChunk, RateLimitError } from "../services/acrcloud.js";

function getRetryParams(attempt: number): { offsetSec: number; durationSec: number } {
  switch (attempt) {
    case 2: return { offsetSec: 7, durationSec: 15 };
    case 3: return { offsetSec: 0, durationSec: 10 };
    case 4: return { offsetSec: 5, durationSec: 10 };
    default: return { offsetSec: 3, durationSec: 12 };
  }
}

async function retrySegment(segmentId: string, startSec: number, endSec: number, chunksDir: string, attempt: number): Promise<void> {
  const { offsetSec } = getRetryParams(attempt);

  const chunkFiles = await fs.readdir(chunksDir);
  const sortedChunks = chunkFiles.filter((f) => f.startsWith("chunk_") && f.endsWith(".wav")).sort();

  const targetIdx = Math.floor((startSec + offsetSec) / 10);
  const chunkFile = sortedChunks[Math.min(targetIdx, sortedChunks.length - 1)];

  if (!chunkFile) {
    await db.update(segments).set({ status: "unknown", attempts: attempt, updatedAt: new Date() }).where(eq(segments.id, segmentId));
    return;
  }

  const chunkPath = path.join(chunksDir, chunkFile);

  try {
    const match = await identifyChunk(chunkPath, startSec);

    if (match) {
      await db.update(segments).set({
        status: "identified", trackName: `${match.artist} - ${match.title}`,
        artist: match.artist, title: match.title, acrid: match.acrid,
        externalLinks: match.externalLinks || null,
        attempts: attempt, updatedAt: new Date(),
      }).where(eq(segments.id, segmentId));
      return;
    }

    // Try alternate chunk
    const altIdx = Math.min(targetIdx + 2, sortedChunks.length - 1);
    if (altIdx !== targetIdx && sortedChunks[altIdx]) {
      const altMatch = await identifyChunk(path.join(chunksDir, sortedChunks[altIdx]), startSec);
      if (altMatch) {
        await db.update(segments).set({
          status: "identified", trackName: `${altMatch.artist} - ${altMatch.title}`,
          artist: altMatch.artist, title: altMatch.title, acrid: altMatch.acrid,
          externalLinks: altMatch.externalLinks || null,
          attempts: attempt, updatedAt: new Date(),
        }).where(eq(segments.id, segmentId));
        return;
      }
    }

    await db.update(segments).set({ status: "unknown", attempts: attempt, updatedAt: new Date() }).where(eq(segments.id, segmentId));
  } catch (err) {
    if (err instanceof RateLimitError) {
      await db.update(segments).set({ status: "unknown", updatedAt: new Date() }).where(eq(segments.id, segmentId));
      throw err;
    }
    await db.update(segments).set({ status: "unknown", attempts: attempt, updatedAt: new Date() }).where(eq(segments.id, segmentId));
  }
}

interface RetrySegmentData { analysisId: string; segmentId: string; startSec: number; endSec: number; chunksDir: string; attempt: number; }
interface RetryAllData { analysisId: string; segments: { segmentId: string; startSec: number; endSec: number; attempt: number }[]; chunksDir: string; }

const worker = new Worker(
  "retry",
  async (job: Job<RetrySegmentData | RetryAllData>) => {
    if (job.name === "retry-segment") {
      const data = job.data as RetrySegmentData;
      await retrySegment(data.segmentId, data.startSec, data.endSec, data.chunksDir, data.attempt);
    } else if (job.name === "retry-all-unknown") {
      const data = job.data as RetryAllData;
      for (let i = 0; i < data.segments.length; i++) {
        const seg = data.segments[i];
        try {
          await retrySegment(seg.segmentId, seg.startSec, seg.endSec, data.chunksDir, seg.attempt);
        } catch (err) {
          if (err instanceof RateLimitError) { console.log(`[retry] Rate limit hit at segment ${i + 1}/${data.segments.length}`); break; }
        }
        job.updateProgress({ analysisId: data.analysisId, processed: i + 1, total: data.segments.length });
      }
    }
  },
  { connection: redis, concurrency: 1 }
);

worker.on("ready", () => console.log("Retry worker ready"));
worker.on("failed", (job, err) => console.error(`Retry job ${job?.id} failed:`, err.message));

export default worker;
