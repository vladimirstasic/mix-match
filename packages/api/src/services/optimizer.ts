import {
  SILENCE_THRESHOLD_DB,
} from "@mix-match/shared";
import type { RawMatch, AnalysisMetrics } from "@mix-match/shared";
import { identifyChunk, RateLimitError } from "./acrcloud.js";

export interface OptimizerContext {
  chunkPaths: string[];
  chunkPositions: number[];
  rmsLevels: number[];
  onProgress: (processed: number, total: number, currentTrack?: string, tracksFound?: number) => void;
}

export async function processChunksOptimized(ctx: OptimizerContext): Promise<{
  matches: RawMatch[];
  metrics: Omit<AnalysisMetrics, "processingTimeMs" | "avgApiLatencyMs">;
}> {
  const { chunkPaths, rmsLevels, onProgress } = ctx;
  const total = chunkPaths.length;

  const matches: RawMatch[] = [];
  const uniqueTracks = new Set<string>();

  let silenceSkipped = 0;
  let apiCalls = 0;

  function trackMatch(match: RawMatch | null | undefined) {
    if (match) {
      uniqueTracks.add(match.acrid || `${match.artist}-${match.title}`);
    }
  }

  function emitProgress(processed: number, track?: string) {
    onProgress(processed, total, track, uniqueTracks.size);
  }

  for (let i = 0; i < total; i++) {
    const chunkPath = chunkPaths[i];
    const startSec = ctx.chunkPositions[i];

    // Stage 1: Silence gate
    if (rmsLevels[i] < SILENCE_THRESHOLD_DB) {
      silenceSkipped++;
      emitProgress(i + 1);
      continue;
    }

    // Stage 2: ACRCloud API call
    apiCalls++;
    try {
      const match = await identifyChunk(chunkPath, startSec);

      if (match) {
        matches.push(match);
      }
      trackMatch(match);
      emitProgress(i + 1, match?.title);
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.log(`[optimizer] Rate limit hit at chunk ${i + 1}/${total}, saving partial results`);
        emitProgress(total);
        break;
      }
      throw err;
    }
  }

  const apiSavingsPercent = total > 0 ? ((1 - apiCalls / total) * 100) : 0;

  return {
    matches,
    metrics: {
      totalChunks: total,
      silenceSkipped,
      coastSkipped: 0,
      dedupSkipped: 0,
      cacheHits: 0,
      apiCalls,
      apiSavingsPercent: Math.round(apiSavingsPercent * 10) / 10,
    },
  };
}
