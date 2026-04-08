import {
  SILENCE_THRESHOLD_DB,
  COAST_MODE_CONFIRM_COUNT,
  COAST_MODE_CHECK_INTERVAL,
  REDIS_FINGERPRINT_TTL,
} from "@mix-detective/shared";
import type { RawMatch, AnalysisMetrics } from "@mix-detective/shared";
import { generateFingerprint, isSimilar } from "./fingerprint.js";
import { identifyChunk } from "./acrcloud.js";
import { redis } from "../queue/index.js";

export interface OptimizerContext {
  chunkPaths: string[];
  rmsLevels: number[];
  onProgress: (processed: number, total: number, currentTrack?: string) => void;
}

interface ChunkDecision {
  action: "skip_silence" | "skip_coast" | "skip_dedup" | "cache_hit" | "api_call";
  match: RawMatch | null;
}

export async function processChunksOptimized(ctx: OptimizerContext): Promise<{
  matches: RawMatch[];
  metrics: Omit<AnalysisMetrics, "processingTimeMs" | "avgApiLatencyMs">;
}> {
  const { chunkPaths, rmsLevels, onProgress } = ctx;
  const total = chunkPaths.length;

  const matches: RawMatch[] = [];
  const seenFingerprints: { fp: Buffer; match: RawMatch | null }[] = [];

  let currentTrackId: string | null = null;
  let consecutiveConfirms = 0;
  let coastMode = false;
  let chunksSinceLastCheck = 0;

  let silenceSkipped = 0;
  let coastSkipped = 0;
  let dedupSkipped = 0;
  let cacheHits = 0;
  let apiCalls = 0;
  let totalApiLatency = 0;

  for (let i = 0; i < total; i++) {
    const chunkPath = chunkPaths[i];
    const startSec = i * 15;

    // Stage 1: Silence gate
    if (rmsLevels[i] < SILENCE_THRESHOLD_DB) {
      silenceSkipped++;
      coastMode = false;
      currentTrackId = null;
      consecutiveConfirms = 0;
      onProgress(i + 1, total);
      continue;
    }

    // Stage 2: Early confirmation (coast mode)
    if (coastMode) {
      chunksSinceLastCheck++;
      if (chunksSinceLastCheck < COAST_MODE_CHECK_INTERVAL) {
        coastSkipped++;
        if (currentTrackId && matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          matches.push({ ...lastMatch, startSec });
        }
        onProgress(i + 1, total, matches[matches.length - 1]?.title);
        continue;
      }
      chunksSinceLastCheck = 0;
    }

    // Stage 3: Fingerprint dedup
    const fp = await generateFingerprint(chunkPath);
    const similar = seenFingerprints.find((s) => isSimilar(fp, s.fp));
    if (similar) {
      dedupSkipped++;
      if (similar.match) {
        matches.push({ ...similar.match, startSec });
        updateCoastState(similar.match);
      }
      onProgress(i + 1, total, similar.match?.title);
      continue;
    }

    // Stage 4: Redis cache
    const fpHash = fp.toString("hex");
    const cached = await redis.get(`acr:fp:${fpHash}`);
    if (cached) {
      cacheHits++;
      const cachedMatch = JSON.parse(cached) as RawMatch;
      cachedMatch.startSec = startSec;
      matches.push(cachedMatch);
      seenFingerprints.push({ fp, match: cachedMatch });
      updateCoastState(cachedMatch);
      onProgress(i + 1, total, cachedMatch.title);
      continue;
    }

    // Stage 5: ACRCloud API call
    const apiStart = Date.now();
    apiCalls++;
    const match = await identifyChunk(chunkPath, startSec);
    totalApiLatency += Date.now() - apiStart;

    if (match) {
      await redis.setex(`acr:fp:${fpHash}`, REDIS_FINGERPRINT_TTL, JSON.stringify(match));
      matches.push(match);
    }
    seenFingerprints.push({ fp, match });
    updateCoastState(match);
    onProgress(i + 1, total, match?.title);
  }

  function updateCoastState(match: RawMatch | null) {
    const trackId = match ? `${match.artist}-${match.title}` : null;
    if (trackId === currentTrackId && trackId !== null) {
      consecutiveConfirms++;
      if (consecutiveConfirms >= COAST_MODE_CONFIRM_COUNT) {
        coastMode = true;
        chunksSinceLastCheck = 0;
      }
    } else {
      currentTrackId = trackId;
      consecutiveConfirms = 1;
      coastMode = false;
    }
  }

  const apiSavingsPercent = total > 0 ? ((1 - apiCalls / total) * 100) : 0;

  return {
    matches,
    metrics: {
      totalChunks: total,
      silenceSkipped,
      coastSkipped,
      dedupSkipped,
      cacheHits,
      apiCalls,
      apiSavingsPercent: Math.round(apiSavingsPercent * 10) / 10,
    },
  };
}
