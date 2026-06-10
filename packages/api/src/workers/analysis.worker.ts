import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import { v4 as uuid } from 'uuid';
import {
  REDIS_FILE_CACHE_TTL,
  CHUNK_DURATION_SEC,
  CHUNKS_TTL_HOURS,
  FAST_STEP_SEC,
  DETAILED_STEP_SEC,
} from '@mix-match/shared';
import { config } from '../config.js';
import { redis } from '../queue';
import { db } from '../db/client.js';
import { analyses, segments as segmentsTable } from '../db/schema.js';
import {
  normalizeAudio,
  getDuration,
  splitIntoChunks,
  extractRmsLevels,
  generateWaveform,
} from '../services/ffmpeg.js';
import { processChunksOptimized } from '../services/optimizer.js';
import { aggregateMatches, consolidateTimeline } from '../services/aggregator.js';
import { buildSegments } from '../services/segments.js';

const execFileAsync = promisify(execFile);

interface AnalysisJobData {
  analysisId: string;
  filePath?: string;
  fileHash?: string;
  url?: string;
  mode?: 'fast' | 'detailed';
}

async function downloadUrl(
  analysisId: string,
  url: string,
): Promise<{ filePath: string; fileHash: string; filename: string }> {
  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url);
  const baseYtArgs = ['--force-ipv4', '--socket-timeout', '30', '--retries', '2'];
  if (isYouTube && process.env.YTDLP_PROXY) {
    baseYtArgs.push('--proxy', process.env.YTDLP_PROXY);
  }

  const outputPath = path.join(config.uploadDir, uuid() + '.mp3');

  const { stdout: title } = await execFileAsync('yt-dlp', [...baseYtArgs, '--print', 'title', url], {
    timeout: 90_000,
  });
  const filename = title.trim() || 'Unknown title';

  await execFileAsync(
    'yt-dlp',
    [...baseYtArgs, '-x', '--audio-format', 'mp3', '--max-filesize', '300m', '-o', outputPath, url],
    { timeout: 5 * 60_000 },
  );

  const fileHash = await new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(outputPath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

  const stat = await fs.stat(outputPath);
  await db
    .update(analyses)
    .set({ filename, fileSize: stat.size, fileHash, updatedAt: new Date() })
    .where(eq(analyses.id, analysisId));

  return { filePath: outputPath, fileHash, filename };
}

const worker = new Worker<AnalysisJobData>(
  'analysis',
  async (job: Job<AnalysisJobData>) => {
    let { analysisId, filePath, fileHash, mode } = job.data;

    if (job.name === 'download-and-analyze' && job.data.url) {
      const result = await downloadUrl(analysisId, job.data.url);
      filePath = result.filePath;
      fileHash = result.fileHash;
    }

    if (!filePath || !fileHash) {
      throw new Error('Missing filePath or fileHash');
    }

    const stepSec = mode === 'detailed' ? DETAILED_STEP_SEC : FAST_STEP_SEC;
    const workDir = path.join(config.uploadDir, analysisId);
    const wavPath = path.join(workDir, 'normalized.wav');

    try {
      await db.update(analyses).set({ status: 'processing', updatedAt: new Date() }).where(eq(analyses.id, analysisId));

      await fs.mkdir(workDir, { recursive: true });
      await normalizeAudio(filePath, wavPath);

      const duration = await getDuration(wavPath);
      const totalChunks = Math.ceil(duration / CHUNK_DURATION_SEC);

      // Generate waveform data (1 point per second)
      const waveformData = await generateWaveform(wavPath);

      const chunksDir = path.join(workDir, 'chunks');
      const chunksExpireAt = new Date(Date.now() + CHUNKS_TTL_HOURS * 60 * 60 * 1000);
      await db
        .update(analyses)
        .set({ totalChunks, chunksDir, chunksExpireAt, waveformData, updatedAt: new Date() })
        .where(eq(analyses.id, analysisId));

      const { paths: chunkPaths, positions: chunkPositions } = await splitIntoChunks(wavPath, chunksDir, stepSec);

      const rmsLevels = await extractRmsLevels(chunkPaths);

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

      // Diagnostic: dump raw matches (with scores + offsets) when enabled, so a
      // real fixture can be captured for offline tuning of the spurious-match
      // filter without burning ACRCloud quota on repeated prod scans.
      if (process.env.DEBUG_DUMP_MATCHES === '1') {
        console.log(`[debug-dump:${analysisId}] ${JSON.stringify(matches)}`);
      }

      const results = consolidateTimeline(aggregateMatches(matches));

      const segmentData = buildSegments(results, Math.ceil(duration));
      await db.insert(segmentsTable).values(
        segmentData.map(s => ({
          analysisId,
          startSec: s.startSec,
          endSec: s.endSec,
          status: s.status,
          trackName: s.trackName,
          artist: s.artist,
          title: s.title,
          acrid: s.acrid,
          bpm: s.bpm,
          genre: s.genre,
          musicalKey: s.musicalKey,
          confidence: s.confidence,
          externalLinks: s.externalLinks,
          attempts: 1,
        })),
      );

      const fullMetrics = {
        ...metrics,
        processingTimeMs,
        avgApiLatencyMs:
          metrics.apiCalls > 0 ? Math.round((processingTimeMs - metrics.silenceSkipped * 5) / metrics.apiCalls) : 0,
      };

      await db
        .update(analyses)
        .set({
          status: 'completed',
          processedChunks: totalChunks,
          results,
          metrics: fullMetrics,
          updatedAt: new Date(),
        })
        .where(eq(analyses.id, analysisId));

      await redis.setex(`acr:file:${fileHash}`, REDIS_FILE_CACHE_TTL, analysisId);

      console.log(`[analysis:${analysisId}] Processing complete`);
      console.log(`  Total chunks:     ${fullMetrics.totalChunks}`);
      console.log(
        `  Silence skipped:  ${fullMetrics.silenceSkipped} (${((fullMetrics.silenceSkipped / fullMetrics.totalChunks) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Coast skipped:    ${fullMetrics.coastSkipped} (${((fullMetrics.coastSkipped / fullMetrics.totalChunks) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Dedup skipped:    ${fullMetrics.dedupSkipped} (${((fullMetrics.dedupSkipped / fullMetrics.totalChunks) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Cache hits:       ${fullMetrics.cacheHits} (${((fullMetrics.cacheHits / fullMetrics.totalChunks) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  API calls:        ${fullMetrics.apiCalls} (${((fullMetrics.apiCalls / fullMetrics.totalChunks) * 100).toFixed(1)}%)`,
      );
      console.log(`  → Savings:        ${fullMetrics.apiSavingsPercent}% fewer API calls`);
      console.log(`  Tracks detected:  ${results.length}`);
      console.log(`  Processing time:  ${(fullMetrics.processingTimeMs / 1000).toFixed(1)}s`);
    } catch (err) {
      await db
        .update(analyses)
        .set({
          status: 'failed',
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
      await fs.unlink(wavPath).catch(() => {});
      await fs.unlink(filePath).catch(() => {});
    }
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

worker.on('ready', () => console.log('Analysis worker ready'));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));

export default worker;
