import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { REDIS_FILE_CACHE_TTL, CHUNK_DURATION_SEC } from "@mix-detective/shared";
import { config } from "../config.js";
import { redis } from "../queue/index.js";
import { db } from "../db/client.js";
import { analyses } from "../db/schema.js";
import { normalizeAudio, getDuration, splitIntoChunks, extractRmsLevels } from "../services/ffmpeg.js";
import { processChunksOptimized } from "../services/optimizer.js";
import { aggregateMatches } from "../services/aggregator.js";

interface AnalysisJobData {
  analysisId: string;
  filePath: string;
  fileHash: string;
}

const worker = new Worker<AnalysisJobData>(
  "analysis",
  async (job: Job<AnalysisJobData>) => {
    const { analysisId, filePath, fileHash } = job.data;
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

      await db
        .update(analyses)
        .set({ totalChunks, updatedAt: new Date() })
        .where(eq(analyses.id, analysisId));

      const chunksDir = path.join(workDir, "chunks");
      const chunkPaths = await splitIntoChunks(wavPath, chunksDir);

      const rmsLevels = await extractRmsLevels(wavPath, totalChunks);

      const startTime = Date.now();
      const { matches, metrics } = await processChunksOptimized({
        chunkPaths,
        rmsLevels,
        onProgress: (processed, total, currentTrack) => {
          job.updateProgress({
            analysisId,
            chunksProcessed: processed,
            totalChunks: total,
            currentTrack,
          });
        },
      });

      const processingTimeMs = Date.now() - startTime;

      const results = aggregateMatches(matches);

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
      throw err;
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
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
