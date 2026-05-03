import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { REDIS_FILE_CACHE_TTL, CHUNK_DURATION_SEC, CHUNKS_TTL_HOURS, FAST_STEP_SEC, DETAILED_STEP_SEC } from "@mix-match/shared";
import { config } from "../config.js";
import { redis } from "../queue";
import { db } from "../db/client.js";
import { analyses, segments as segmentsTable } from "../db/schema.js";
import { normalizeAudio, getDuration, splitIntoChunks, extractRmsLevels } from "../services/ffmpeg.js";
import { processChunksOptimized } from "../services/optimizer.js";
import { aggregateMatches } from "../services/aggregator.js";
import { buildSegments } from "../services/segments.js";

interface AnalysisJobData {
  analysisId: string;
  filePath: string;
  fileHash: string;
  mode?: "fast" | "detailed";
}

const worker = new Worker<AnalysisJobData>(
  "analysis",
  async (job: Job<AnalysisJobData>) => {
    const { analysisId, filePath, fileHash, mode } = job.data;
    const stepSec = mode === "detailed" ? DETAILED_STEP_SEC : FAST_STEP_SEC;
    const workDir = path.join(config.uploadDir, analysisId);

    try {
      await db
        .update(analyses)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(analyses.id, analysisId));

      await fs.mkdir(workDir, { recursive: true });

      const wavPath = path.join(workDir, "normalized.wav");
      await normalizeAudio(filePath, wavPath);

      const duration = await getDuration(wavPath);
      const totalChunks = Math.ceil(duration / CHUNK_DURATION_SEC);

      const chunksDir = path.join(workDir, "chunks");
      const chunksExpireAt = new Date(Date.now() + CHUNKS_TTL_HOURS * 60 * 60 * 1000);
        await db
            .update(analyses)
            .set({ totalChunks, chunksDir, chunksExpireAt, updatedAt: new Date() })
            .where(eq(analyses.id, analysisId));

      const { paths: chunkPaths, positions: chunkPositions } = await splitIntoChunks(wavPath, chunksDir, stepSec);

      const rmsLevels = await extractRmsLevels(wavPath, totalChunks, chunkPaths);

      const startTime = Date.now();
      const { matches, metrics } = await processChunksOptimized({
        chunkPaths,
        chunkPositions,
        rmsLevels,
        onProgress: (processed, total, currentTrack, tracksFound) => {
          job.updateProgress({
            analysisId,
            chunksProcessed: processed,
            totalChunks: total,
            currentTrack,
            tracksFound,
          });
        },
      });

      const processingTimeMs = Date.now() - startTime;

      const results = aggregateMatches(matches);

      const segmentData = buildSegments(results, Math.ceil(duration));
      await db.insert(segmentsTable).values(
        segmentData.map((s) => ({
          analysisId,
          startSec: s.startSec,
          endSec: s.endSec,
          status: s.status,
          trackName: s.trackName,
          artist: s.artist,
          title: s.title,
          acrid: s.acrid,
          externalLinks: s.externalLinks,
          attempts: 1,
        }))
      );

      const fullMetrics = {
        ...metrics,
        processingTimeMs,
        avgApiLatencyMs: metrics.apiCalls > 0
          ? Math.round((processingTimeMs - metrics.silenceSkipped * 5) / metrics.apiCalls)
          : 0,
      };

      await db
        .update(analyses)
        .set({
          status: "completed",
          processedChunks: totalChunks,
          results,
          metrics: fullMetrics,
          updatedAt: new Date(),
        })
        .where(eq(analyses.id, analysisId));

      await redis.setex(`acr:file:${fileHash}`, REDIS_FILE_CACHE_TTL, analysisId);

      console.log(`[analysis:${analysisId}] Processing complete`);
      console.log(`  Total chunks:     ${fullMetrics.totalChunks}`);
      console.log(`  Silence skipped:  ${fullMetrics.silenceSkipped} (${((fullMetrics.silenceSkipped / fullMetrics.totalChunks) * 100).toFixed(1)}%)`);
      console.log(`  Coast skipped:    ${fullMetrics.coastSkipped} (${((fullMetrics.coastSkipped / fullMetrics.totalChunks) * 100).toFixed(1)}%)`);
      console.log(`  Dedup skipped:    ${fullMetrics.dedupSkipped} (${((fullMetrics.dedupSkipped / fullMetrics.totalChunks) * 100).toFixed(1)}%)`);
      console.log(`  Cache hits:       ${fullMetrics.cacheHits} (${((fullMetrics.cacheHits / fullMetrics.totalChunks) * 100).toFixed(1)}%)`);
      console.log(`  API calls:        ${fullMetrics.apiCalls} (${((fullMetrics.apiCalls / fullMetrics.totalChunks) * 100).toFixed(1)}%)`);
      console.log(`  → Savings:        ${fullMetrics.apiSavingsPercent}% fewer API calls`);
      console.log(`  Tracks detected:  ${results.length}`);
      console.log(`  Processing time:  ${(fullMetrics.processingTimeMs / 1000).toFixed(1)}s`);
    } catch (err) {
      await db
        .update(analyses)
        .set({
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(analyses.id, analysisId));
      // On failure, clean up everything
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      await fs.unlink(filePath).catch(() => {});
      throw err;
    } finally {
      // Keep chunks for retry, only clean up source files
      const wavPath2 = path.join(workDir, "normalized.wav");
      await fs.unlink(wavPath2).catch(() => {});
      await fs.unlink(filePath).catch(() => {});
    }
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

worker.on("ready", () => console.log("Analysis worker ready"));
worker.on("failed", (job, err) => console.error(`Job ${job?.id} failed:`, err.message));

export default worker;
