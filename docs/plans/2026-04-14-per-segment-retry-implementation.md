# Per-Segment Retry & Overlap Chunks — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable per-segment retry of unidentified tracks and improve recognition accuracy with overlapping chunks.

**Architecture:** New `segments` table stores individual track results linked to analyses. Worker saves chunk files for 24h to enable retry. Overlap chunking (15s chunks, 10s step) improves coverage. Retry jobs re-analyze specific time ranges with varied parameters.

**Tech Stack:** Drizzle ORM migrations, BullMQ retry jobs, Express endpoints, React SSE updates

**Design doc:** `docs/plans/2026-04-14-per-segment-retry-design.md`

---

## Task 1: Add `segments` table and update `analyses` schema

**Files:**
- Modify: `packages/api/src/db/schema.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

**Step 1: Update shared types**

Add new types to `packages/shared/src/types.ts`:

```typescript
export type SegmentStatus = "identified" | "unknown" | "retrying";

export interface Segment {
  id: string;
  analysisId: string;
  startSec: number;
  endSec: number;
  status: SegmentStatus;
  trackName: string | null;
  artist: string | null;
  title: string | null;
  acrid: string | null;
  confidence: number | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisWithSegments extends Omit<AnalysisResult, "results"> {
  segments: Segment[];
  chunksAvailable: boolean;
  chunksExpireAt: string | null;
  results: TrackMatch[] | null;
}
```

Add new constant to `packages/shared/src/constants.ts`:

```typescript
export const CHUNKS_TTL_HOURS = 24;
export const CHUNK_OVERLAP_SEC = 5;
export const CHUNK_STEP_SEC = CHUNK_DURATION_SEC - CHUNK_OVERLAP_SEC; // 10
```

**Step 2: Update Drizzle schema**

Add to `packages/api/src/db/schema.ts`:

```typescript
import { pgTable, uuid, varchar, integer, jsonb, text, timestamp, real } from "drizzle-orm/pg-core";

// Keep existing analyses table, add two columns:
export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  fileHash: varchar("file_hash", { length: 64 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  totalChunks: integer("total_chunks"),
  processedChunks: integer("processed_chunks").default(0),
  results: jsonb("results"),
  metrics: jsonb("metrics"),
  error: text("error"),
  chunksDir: varchar("chunks_dir", { length: 500 }),          // NEW
  chunksExpireAt: timestamp("chunks_expire_at"),                // NEW
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysisId: uuid("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
  startSec: integer("start_sec").notNull(),
  endSec: integer("end_sec").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("unknown"),
  trackName: varchar("track_name", { length: 500 }),
  artist: varchar("artist", { length: 255 }),
  title: varchar("title", { length: 255 }),
  acrid: varchar("acrid", { length: 100 }),
  confidence: real("confidence"),
  attempts: integer("attempts").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Step 3: Generate and run migration**

```bash
npm run db:generate -w packages/api
npm run db:migrate -w packages/api
```

Verify the generated SQL adds `segments` table and new columns to `analyses`.

**Step 4: Rebuild shared**

```bash
npm run build -w packages/shared
```

**Step 5: Commit**

```bash
git add packages/api/src/db/schema.ts packages/shared/src/types.ts packages/shared/src/constants.ts packages/api/src/db/migrations/
git commit -m "feat: add segments table and overlap chunk constants"
```

---

## Task 2: Implement overlap chunk splitting

**Files:**
- Modify: `packages/api/src/services/ffmpeg.ts`
- Modify: `packages/api/src/services/ffmpeg.test.ts` (if exists)

**Step 1: Write test for overlap splitting**

Create `packages/api/src/services/__tests__/ffmpeg-overlap.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeChunkPositions } from "../ffmpeg.js";

describe("computeChunkPositions", () => {
  it("generates overlapping positions for a 60s file", () => {
    const positions = computeChunkPositions(60, 15, 10);
    // Positions: 0, 10, 20, 30, 40, 50
    expect(positions).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("generates single chunk for short file", () => {
    const positions = computeChunkPositions(12, 15, 10);
    expect(positions).toEqual([0]);
  });

  it("handles exact multiple of step", () => {
    const positions = computeChunkPositions(30, 15, 10);
    expect(positions).toEqual([0, 10, 20]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run packages/api/src/services/__tests__/ffmpeg-overlap.test.ts
```

Expected: FAIL — `computeChunkPositions` not exported.

**Step 3: Implement overlap splitting**

In `packages/api/src/services/ffmpeg.ts`, add `computeChunkPositions` and modify `splitIntoChunks`:

```typescript
import { CHUNK_DURATION_SEC, CHUNK_STEP_SEC } from "@mix-match/shared";

// Pure function for testability
export function computeChunkPositions(durationSec: number, chunkDuration: number, stepSec: number): number[] {
  const positions: number[] = [];
  for (let pos = 0; pos < durationSec; pos += stepSec) {
    positions.push(pos);
  }
  return positions;
}

export async function splitIntoChunks(wavPath: string, outputDir: string): Promise<{ paths: string[]; positions: number[] }> {
  await fs.mkdir(outputDir, { recursive: true });

  const duration = await getDuration(wavPath);
  const positions = computeChunkPositions(duration, CHUNK_DURATION_SEC, CHUNK_STEP_SEC);

  const paths: string[] = [];
  for (let i = 0; i < positions.length; i++) {
    const outFile = path.join(outputDir, `chunk_${String(i).padStart(4, "0")}.wav`);
    await exec("ffmpeg", [
      "-i", wavPath,
      "-ss", String(positions[i]),
      "-t", String(CHUNK_DURATION_SEC),
      "-c", "copy",
      "-y",
      outFile,
    ]);
    paths.push(outFile);
  }

  return { paths, positions };
}
```

**IMPORTANT:** `splitIntoChunks` now returns `{ paths, positions }` instead of just `string[]`. All callers must be updated.

**Step 4: Run tests**

```bash
npx vitest run packages/api/src/services/__tests__/ffmpeg-overlap.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/services/ffmpeg.ts packages/api/src/services/__tests__/ffmpeg-overlap.test.ts
git commit -m "feat: implement overlap chunk splitting with 5s overlap"
```

---

## Task 3: Update optimizer for overlap-aware startSec

**Files:**
- Modify: `packages/api/src/services/optimizer.ts`

**Step 1: Update optimizer to accept positions array**

The optimizer currently calculates `startSec = i * 15`. With overlap, each chunk's start position comes from the positions array.

In `packages/api/src/services/optimizer.ts`:

```typescript
export interface OptimizerContext {
  chunkPaths: string[];
  chunkPositions: number[];  // NEW — start position of each chunk in seconds
  rmsLevels: number[];
  onProgress: (processed: number, total: number, currentTrack?: string, tracksFound?: number) => void;
}
```

Replace `const startSec = i * 15;` with:

```typescript
const startSec = ctx.chunkPositions[i];
```

This is the only change needed in the optimizer loop. Coast mode, dedup, and caching all work the same way.

**Step 2: Commit**

```bash
git add packages/api/src/services/optimizer.ts
git commit -m "feat: optimizer uses explicit chunk positions for overlap support"
```

---

## Task 4: Update aggregator to handle overlapping matches

**Files:**
- Modify: `packages/api/src/services/aggregator.ts`
- Modify: `packages/api/src/services/__tests__/aggregator.test.ts`

**Step 1: Write test for overlap aggregation**

Add to `packages/api/src/services/__tests__/aggregator.test.ts`:

```typescript
it("handles overlapping chunks correctly", () => {
  const result = aggregateMatches([
    { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 0 },
    { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 10 },
    { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 20 },
    { artist: "Chemical Brothers", title: "Block Rockin Beats", acrid: "b", startSec: 30 },
    { artist: "Chemical Brothers", title: "Block Rockin Beats", acrid: "b", startSec: 40 },
  ]);

  expect(result).toEqual([
    { track: "Daft Punk - Around the World", start: "00:00", end: "00:35" },
    { track: "Chemical Brothers - Block Rockin Beats", start: "00:30", end: "00:55" },
  ]);
});
```

**Step 2: Run test**

```bash
npx vitest run packages/api/src/services/__tests__/aggregator.test.ts
```

This should pass with the existing aggregator logic since it already merges consecutive same-track matches and uses `startSec + CHUNK_DURATION_SEC` for `groupEnd`. If it fails, adjust the aggregator.

**Step 3: Commit**

```bash
git add packages/api/src/services/__tests__/aggregator.test.ts packages/api/src/services/aggregator.ts
git commit -m "test: verify aggregator handles overlapping chunks"
```

---

## Task 5: Update worker to save segments and keep chunks

**Files:**
- Modify: `packages/api/src/workers/analysis.worker.ts`
- Modify: `packages/api/src/db/schema.ts` (import segments)

**Step 1: Create segment-building helper**

Create `packages/api/src/services/segments.ts`:

```typescript
import type { RawMatch } from "@mix-match/shared";
import { CHUNK_DURATION_SEC } from "@mix-match/shared";

export interface SegmentData {
  startSec: number;
  endSec: number;
  status: "identified" | "unknown";
  trackName: string | null;
  artist: string | null;
  title: string | null;
  acrid: string | null;
}

/**
 * Convert raw matches + total duration into segments (identified + gaps as unknown).
 * Matches are already aggregated (consecutive same-track merged).
 */
export function buildSegments(
  aggregatedMatches: { track: string; start: string; end: string }[],
  rawMatches: RawMatch[],
  totalDurationSec: number
): SegmentData[] {
  if (aggregatedMatches.length === 0) {
    return [{
      startSec: 0,
      endSec: totalDurationSec,
      status: "unknown",
      trackName: null,
      artist: null,
      title: null,
      acrid: null,
    }];
  }

  const segments: SegmentData[] = [];

  // Parse "mm:ss" to seconds
  const toSec = (ts: string) => {
    const [m, s] = ts.split(":").map(Number);
    return m * 60 + s;
  };

  let cursor = 0;

  for (const match of aggregatedMatches) {
    const matchStart = toSec(match.start);
    const matchEnd = toSec(match.end);

    // Gap before this match
    if (matchStart > cursor) {
      segments.push({
        startSec: cursor,
        endSec: matchStart,
        status: "unknown",
        trackName: null,
        artist: null,
        title: null,
        acrid: null,
      });
    }

    // Find artist/title from raw matches for this track
    const [artist, ...titleParts] = match.track.split(" - ");
    const title = titleParts.join(" - ");
    const raw = rawMatches.find(
      (r) => r.artist === artist && r.title === title
    );

    segments.push({
      startSec: matchStart,
      endSec: matchEnd,
      status: "identified",
      trackName: match.track,
      artist,
      title,
      acrid: raw?.acrid || null,
    });

    cursor = matchEnd;
  }

  // Gap after last match
  if (cursor < totalDurationSec) {
    segments.push({
      startSec: cursor,
      endSec: totalDurationSec,
      status: "unknown",
      trackName: null,
      artist: null,
      title: null,
      acrid: null,
    });
  }

  return segments;
}
```

**Step 2: Write test for buildSegments**

Create `packages/api/src/services/__tests__/segments.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSegments } from "../segments.js";

describe("buildSegments", () => {
  it("creates segments with gaps as unknown", () => {
    const segments = buildSegments(
      [
        { track: "Daft Punk - Around the World", start: "00:30", end: "02:00" },
        { track: "Chemical Brothers - Hey Boy Hey Girl", start: "03:00", end: "05:00" },
      ],
      [
        { artist: "Daft Punk", title: "Around the World", acrid: "a1", startSec: 30 },
        { artist: "Chemical Brothers", title: "Hey Boy Hey Girl", acrid: "b1", startSec: 180 },
      ],
      360 // 6 min
    );

    expect(segments).toEqual([
      { startSec: 0, endSec: 30, status: "unknown", trackName: null, artist: null, title: null, acrid: null },
      { startSec: 30, endSec: 120, status: "identified", trackName: "Daft Punk - Around the World", artist: "Daft Punk", title: "Around the World", acrid: "a1" },
      { startSec: 120, endSec: 180, status: "unknown", trackName: null, artist: null, title: null, acrid: null },
      { startSec: 180, endSec: 300, status: "identified", trackName: "Chemical Brothers - Hey Boy Hey Girl", artist: "Chemical Brothers", title: "Hey Boy Hey Girl", acrid: "b1" },
      { startSec: 300, endSec: 360, status: "unknown", trackName: null, artist: null, title: null, acrid: null },
    ]);
  });

  it("returns single unknown for no matches", () => {
    const segments = buildSegments([], [], 120);
    expect(segments).toEqual([
      { startSec: 0, endSec: 120, status: "unknown", trackName: null, artist: null, title: null, acrid: null },
    ]);
  });
});
```

**Step 3: Run test**

```bash
npx vitest run packages/api/src/services/__tests__/segments.test.ts
```

Expected: PASS

**Step 4: Update worker**

Modify `packages/api/src/workers/analysis.worker.ts`:

Key changes:
1. Import `segments` table and `buildSegments`
2. Update `splitIntoChunks` call to destructure `{ paths, positions }`
3. Pass `chunkPositions` to optimizer
4. After aggregation, build segments and insert into DB
5. Save `chunksDir` and `chunksExpireAt` in analyses
6. **Remove** the `finally` block that deletes workDir and filePath — keep chunks for retry
7. Still delete the original uploaded file and normalized.wav (only keep chunks/)

```typescript
import { segments as segmentsTable } from "../db/schema.js";
import { buildSegments } from "../services/segments.js";
import { CHUNKS_TTL_HOURS } from "@mix-match/shared";

// Inside the worker callback, replace the chunk splitting section:

const chunksDir = path.join(workDir, "chunks");
const { paths: chunkPaths, positions: chunkPositions } = await splitIntoChunks(wavPath, chunksDir);
const totalChunks = chunkPaths.length;

// Update analyses with totalChunks and chunksDir
const chunksExpireAt = new Date(Date.now() + CHUNKS_TTL_HOURS * 60 * 60 * 1000);
await db
  .update(analyses)
  .set({ totalChunks, chunksDir, chunksExpireAt, updatedAt: new Date() })
  .where(eq(analyses.id, analysisId));

const rmsLevels = await extractRmsLevels(wavPath, totalChunks, chunkPaths);

const startTime = Date.now();
const { matches, metrics } = await processChunksOptimized({
  chunkPaths,
  chunkPositions,
  rmsLevels,
  onProgress: (processed, total, currentTrack, tracksFound) => {
    job.updateProgress({ analysisId, chunksProcessed: processed, totalChunks: total, currentTrack, tracksFound });
  },
});

const processingTimeMs = Date.now() - startTime;
const results = aggregateMatches(matches);
const duration = await getDuration(wavPath);

// Build and insert segments
const segmentData = buildSegments(results, matches, Math.ceil(duration));
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
    attempts: 1,
  }))
);

// Save results and metrics (keep results JSONB for backward compat)
const fullMetrics = { ...metrics, processingTimeMs, avgApiLatencyMs: metrics.apiCalls > 0 ? Math.round(processingTimeMs / metrics.apiCalls) : 0 };

await db
  .update(analyses)
  .set({ status: "completed", processedChunks: totalChunks, results, metrics: fullMetrics, updatedAt: new Date() })
  .where(eq(analyses.id, analysisId));

// Cleanup: delete original upload and normalized wav, but KEEP chunks for retry
await fs.unlink(filePath).catch(() => {});
await fs.unlink(wavPath).catch(() => {});
```

Update the `finally` block to only clean up on failure:

```typescript
} catch (err) {
  await db
    .update(analyses)
    .set({ status: "failed", error: err instanceof Error ? err.message : String(err), updatedAt: new Date() })
    .where(eq(analyses.id, analysisId));
  // On failure, clean up everything
  await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  await fs.unlink(filePath).catch(() => {});
  throw err;
}
// No finally block — on success, chunks are preserved for retry
```

**Step 5: Commit**

```bash
git add packages/api/src/services/segments.ts packages/api/src/services/__tests__/segments.test.ts packages/api/src/workers/analysis.worker.ts
git commit -m "feat: worker saves segments to DB and preserves chunk files"
```

---

## Task 6: Add retry API endpoints

**Files:**
- Create: `packages/api/src/routes/retry.ts`
- Create: `packages/api/src/workers/retry.worker.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/src/queue/index.ts`

**Step 1: Add retry queue**

In `packages/api/src/queue/index.ts`, add a new queue:

```typescript
export const retryQueue = new Queue("retry", {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
```

**Step 2: Create retry route**

Create `packages/api/src/routes/retry.ts`:

```typescript
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import { db } from "../db/client.js";
import { analyses, segments } from "../db/schema.js";
import { retryQueue } from "../queue/index.js";

export const retryRouter = Router();

// POST /api/analysis/:id/segments/:segmentId/retry
retryRouter.post("/analysis/:id/segments/:segmentId/retry", async (req, res) => {
  const { id, segmentId } = req.params;

  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found" }); return; }

  // Check chunks still exist
  if (!analysis.chunksDir) { res.status(410).json({ error: "Chunk files not available" }); return; }
  try {
    await fs.access(analysis.chunksDir);
  } catch {
    res.status(410).json({ error: "Chunk files expired" });
    return;
  }

  const [segment] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, segmentId), eq(segments.analysisId, id)))
    .limit(1);

  if (!segment) { res.status(404).json({ error: "Segment not found" }); return; }

  // Mark segment as retrying
  await db.update(segments).set({ status: "retrying", updatedAt: new Date() }).where(eq(segments.id, segmentId));

  const job = await retryQueue.add("retry-segment", {
    analysisId: id,
    segmentId,
    startSec: segment.startSec,
    endSec: segment.endSec,
    chunksDir: analysis.chunksDir,
    attempt: segment.attempts + 1,
  });

  res.json({ jobId: job.id });
});

// POST /api/analysis/:id/retry-unknown
retryRouter.post("/analysis/:id/retry-unknown", async (req, res) => {
  const { id } = req.params;

  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
  if (!analysis) { res.status(404).json({ error: "Analysis not found" }); return; }
  if (!analysis.chunksDir) { res.status(410).json({ error: "Chunk files not available" }); return; }

  try {
    await fs.access(analysis.chunksDir);
  } catch {
    res.status(410).json({ error: "Chunk files expired" });
    return;
  }

  const unknownSegments = await db
    .select()
    .from(segments)
    .where(and(eq(segments.analysisId, id), eq(segments.status, "unknown")));

  if (unknownSegments.length === 0) { res.json({ message: "No unknown segments" }); return; }

  // Mark all as retrying
  for (const seg of unknownSegments) {
    await db.update(segments).set({ status: "retrying", updatedAt: new Date() }).where(eq(segments.id, seg.id));
  }

  const job = await retryQueue.add("retry-all-unknown", {
    analysisId: id,
    segments: unknownSegments.map((s) => ({
      segmentId: s.id,
      startSec: s.startSec,
      endSec: s.endSec,
      attempt: s.attempts + 1,
    })),
    chunksDir: analysis.chunksDir,
  });

  res.json({ jobId: job.id, segmentCount: unknownSegments.length });
});
```

**Step 3: Create retry worker**

Create `packages/api/src/workers/retry.worker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { CHUNK_DURATION_SEC } from "@mix-match/shared";
import { redis } from "../queue";
import { db } from "../db/client.js";
import { segments } from "../db/schema.js";
import { identifyChunk, RateLimitError } from "../services/acrcloud.js";
import { config } from "../config.js";

// Retry strategies: different offset and duration per attempt
function getRetryParams(attempt: number): { offsetSec: number; durationSec: number } {
  switch (attempt) {
    case 2: return { offsetSec: 7, durationSec: 15 };
    case 3: return { offsetSec: 0, durationSec: 10 };
    case 4: return { offsetSec: 5, durationSec: 10 };
    default: return { offsetSec: 3, durationSec: 12 };
  }
}

async function retrySegment(
  segmentId: string,
  startSec: number,
  endSec: number,
  chunksDir: string,
  attempt: number,
): Promise<void> {
  const { offsetSec, durationSec } = getRetryParams(attempt);

  // Find chunk files that cover this segment's time range
  const chunkFiles = await fs.readdir(chunksDir);
  const sortedChunks = chunkFiles
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
    .sort();

  // Try identifying with offset within the segment range
  const segmentMidpoint = startSec + offsetSec;
  // Find the closest chunk to this position
  // Chunk index ≈ position / step_sec (10)
  const targetIdx = Math.floor(segmentMidpoint / 10);
  const chunkFile = sortedChunks[Math.min(targetIdx, sortedChunks.length - 1)];

  if (!chunkFile) {
    await db.update(segments)
      .set({ status: "unknown", attempts: attempt, updatedAt: new Date() })
      .where(eq(segments.id, segmentId));
    return;
  }

  const chunkPath = path.join(chunksDir, chunkFile);

  try {
    const match = await identifyChunk(chunkPath, startSec);

    if (match) {
      await db.update(segments).set({
        status: "identified",
        trackName: `${match.artist} - ${match.title}`,
        artist: match.artist,
        title: match.title,
        acrid: match.acrid,
        attempts: attempt,
        updatedAt: new Date(),
      }).where(eq(segments.id, segmentId));
    } else {
      // Try another chunk in the range if available
      const altIdx = Math.min(targetIdx + 2, sortedChunks.length - 1);
      if (altIdx !== targetIdx && sortedChunks[altIdx]) {
        const altPath = path.join(chunksDir, sortedChunks[altIdx]);
        const altMatch = await identifyChunk(altPath, startSec);

        if (altMatch) {
          await db.update(segments).set({
            status: "identified",
            trackName: `${altMatch.artist} - ${altMatch.title}`,
            artist: altMatch.artist,
            title: altMatch.title,
            acrid: altMatch.acrid,
            attempts: attempt,
            updatedAt: new Date(),
          }).where(eq(segments.id, segmentId));
          return;
        }
      }

      await db.update(segments).set({
        status: "unknown",
        attempts: attempt,
        updatedAt: new Date(),
      }).where(eq(segments.id, segmentId));
    }
  } catch (err) {
    if (err instanceof RateLimitError) {
      // Revert to unknown, don't increment attempt
      await db.update(segments).set({
        status: "unknown",
        updatedAt: new Date(),
      }).where(eq(segments.id, segmentId));
      throw err;
    }
    await db.update(segments).set({
      status: "unknown",
      attempts: attempt,
      updatedAt: new Date(),
    }).where(eq(segments.id, segmentId));
  }
}

interface RetrySegmentData {
  analysisId: string;
  segmentId: string;
  startSec: number;
  endSec: number;
  chunksDir: string;
  attempt: number;
}

interface RetryAllData {
  analysisId: string;
  segments: { segmentId: string; startSec: number; endSec: number; attempt: number }[];
  chunksDir: string;
}

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
          if (err instanceof RateLimitError) {
            console.log(`[retry] Rate limit hit, stopping at segment ${i + 1}/${data.segments.length}`);
            break;
          }
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
```

**Step 4: Register retry router and update worker script**

In `packages/api/src/index.ts`:

```typescript
import { retryRouter } from "./routes/retry.js";

app.use("/api", retryRouter);
```

In `packages/api/package.json`, add retry worker script:

```json
"worker": "DOTENV_CONFIG_PATH=../../.env tsx src/workers/analysis.worker.ts",
"worker:retry": "DOTENV_CONFIG_PATH=../../.env tsx src/workers/retry.worker.ts"
```

**Step 5: Commit**

```bash
git add packages/api/src/routes/retry.ts packages/api/src/workers/retry.worker.ts packages/api/src/queue/index.ts packages/api/src/index.ts packages/api/package.json
git commit -m "feat: add per-segment retry API endpoints and retry worker"
```

---

## Task 7: Update GET /api/analysis/:id to include segments

**Files:**
- Modify: `packages/api/src/routes/analysis.ts`

**Step 1: Update analysis endpoint**

In `packages/api/src/routes/analysis.ts`, modify the GET handler:

```typescript
import { analyses, segments } from "../db/schema.js";
import fs from "fs/promises";

analysisRouter.get("/analysis/:id", async (req, res) => {
  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, req.params.id))
    .limit(1);

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  // Fetch segments
  const segs = await db
    .select()
    .from(segments)
    .where(eq(segments.analysisId, req.params.id))
    .orderBy(segments.startSec);

  // Check if chunks still exist
  let chunksAvailable = false;
  if (analysis.chunksDir) {
    try {
      await fs.access(analysis.chunksDir);
      chunksAvailable = true;
    } catch {
      chunksAvailable = false;
    }
  }

  res.json({
    ...analysis,
    segments: segs,
    chunksAvailable,
  });
});
```

**Step 2: Commit**

```bash
git add packages/api/src/routes/analysis.ts
git commit -m "feat: analysis endpoint returns segments and chunks availability"
```

---

## Task 8: Update frontend to show segments with retry

**Files:**
- Modify: `packages/web/src/api/client.ts`
- Modify: `packages/web/src/hooks/useAnalysis.ts`
- Modify: `packages/web/src/components/Timeline.tsx`
- Modify: `packages/web/src/App.tsx`

**Step 1: Add retry API calls to client**

In `packages/web/src/api/client.ts`, add:

```typescript
import type { UploadResponse, AnalysisResult, Segment } from "@mix-match/shared";

export interface AnalysisResponse extends AnalysisResult {
  segments: Segment[];
  chunksAvailable: boolean;
}

export async function getAnalysis(id: string): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/analysis/${id}`);
  if (!res.ok) throw new Error("Failed to fetch analysis");
  return res.json();
}

export async function retrySegment(analysisId: string, segmentId: string): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/segments/${segmentId}/retry`, { method: "POST" });
  if (!res.ok) throw new Error("Retry failed");
  return res.json();
}

export async function retryAllUnknown(analysisId: string): Promise<{ jobId: string; segmentCount: number }> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/retry-unknown`, { method: "POST" });
  if (!res.ok) throw new Error("Retry failed");
  return res.json();
}
```

**Step 2: Update useAnalysis hook**

In `packages/web/src/hooks/useAnalysis.ts`, add segments to state and retry functions:

```typescript
import type { TrackMatch, Segment } from "@mix-match/shared";
import { getAnalysis, subscribeProgress, uploadFile, retrySegment as retrySegmentApi, retryAllUnknown as retryAllApi, type AnalysisResponse } from "../api/client";

interface AnalysisState {
  phase: Phase;
  analysisId: string | null;
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  tracksFound: number;
  results: TrackMatch[] | null;
  segments: Segment[];
  chunksAvailable: boolean;
  error: string | null;
}
```

Initial state adds:
```typescript
segments: [],
chunksAvailable: false,
```

On completed, fetch full analysis to get segments:
```typescript
} else if (data.type === "completed") {
  // Fetch full analysis with segments
  const full = await getAnalysis(analysisId);
  setState((s) => ({
    ...s,
    phase: "completed",
    results: full.results as TrackMatch[],
    segments: full.segments,
    chunksAvailable: full.chunksAvailable,
  }));
}
```

Add retry functions:
```typescript
const retrySegment = useCallback(async (segmentId: string) => {
  if (!state.analysisId) return;
  setState((s) => ({
    ...s,
    segments: s.segments.map((seg) =>
      seg.id === segmentId ? { ...seg, status: "retrying" as const } : seg
    ),
  }));
  await retrySegmentApi(state.analysisId, segmentId);
  // Poll for result
  const poll = async () => {
    const full = await getAnalysis(state.analysisId!);
    const seg = full.segments.find((s) => s.id === segmentId);
    if (seg?.status === "retrying") {
      setTimeout(poll, 2000);
    } else {
      setState((s) => ({ ...s, segments: full.segments, results: full.results as TrackMatch[] }));
    }
  };
  setTimeout(poll, 2000);
}, [state.analysisId]);

const retryAll = useCallback(async () => {
  if (!state.analysisId) return;
  setState((s) => ({
    ...s,
    segments: s.segments.map((seg) =>
      seg.status === "unknown" ? { ...seg, status: "retrying" as const } : seg
    ),
  }));
  await retryAllApi(state.analysisId);
  // Poll for results
  const poll = async () => {
    const full = await getAnalysis(state.analysisId!);
    const stillRetrying = full.segments.some((s) => s.status === "retrying");
    if (stillRetrying) {
      setTimeout(poll, 3000);
    } else {
      setState((s) => ({ ...s, segments: full.segments, results: full.results as TrackMatch[] }));
    }
  };
  setTimeout(poll, 3000);
}, [state.analysisId]);
```

Return: `{ ...state, startAnalysis, reset, retrySegment, retryAll }`

**Step 3: Update Timeline component**

Replace `packages/web/src/components/Timeline.tsx`:

```tsx
import type { Segment } from "@mix-match/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCw, Check, HelpCircle, Loader2 } from "lucide-react";

interface Props {
  segments: Segment[];
  chunksAvailable: boolean;
  onRetrySegment: (segmentId: string) => void;
  onRetryAll: () => void;
  onReset: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Timeline({ segments, chunksAvailable, onRetrySegment, onRetryAll, onReset }: Props) {
  const identified = segments.filter((s) => s.status === "identified");
  const unknown = segments.filter((s) => s.status === "unknown");
  const retrying = segments.filter((s) => s.status === "retrying");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Found {identified.length} track{identified.length !== 1 ? "s" : ""}
          {unknown.length > 0 && (
            <span className="text-muted-foreground font-normal text-base ml-2">
              ({unknown.length} unidentified)
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          {unknown.length > 0 && chunksAvailable && (
            <Button variant="outline" size="sm" onClick={onRetryAll} disabled={retrying.length > 0}>
              <RotateCw className="w-4 h-4 mr-1" />
              Retry all unknown
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onReset}>
            New analysis
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {segments.map((seg) => (
          <Card
            key={seg.id}
            className={`border-l-4 ${
              seg.status === "identified"
                ? "border-l-green-500"
                : seg.status === "retrying"
                ? "border-l-yellow-500"
                : "border-l-muted-foreground/30"
            }`}
          >
            <CardContent className="flex items-center gap-4 py-3">
              <span className="font-mono text-sm text-muted-foreground whitespace-nowrap min-w-[120px]">
                {formatTime(seg.startSec)} — {formatTime(seg.endSec)}
              </span>

              {seg.status === "identified" && (
                <>
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="font-medium">{seg.trackName}</span>
                </>
              )}

              {seg.status === "unknown" && (
                <>
                  <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground italic">Unknown track</span>
                  <div className="ml-auto">
                    {chunksAvailable ? (
                      <Button variant="ghost" size="sm" onClick={() => onRetrySegment(seg.id)}>
                        <RotateCw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Chunks expired</span>
                    )}
                  </div>
                </>
              )}

              {seg.status === "retrying" && (
                <>
                  <Loader2 className="w-4 h-4 text-yellow-500 animate-spin shrink-0" />
                  <span className="text-muted-foreground italic">Retrying...</span>
                </>
              )}

              {seg.attempts > 1 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  attempt {seg.attempts}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Update App.tsx**

```tsx
const { phase, uploadProgress, chunksProcessed, totalChunks, currentTrack, tracksFound,
        results, segments, chunksAvailable, error, startAnalysis, reset, retrySegment, retryAll } =
  useAnalysis();

// Replace the completed section:
{phase === "completed" && segments.length > 0 && (
  <Timeline
    segments={segments}
    chunksAvailable={chunksAvailable}
    onRetrySegment={retrySegment}
    onRetryAll={retryAll}
    onReset={reset}
  />
)}
```

**Step 5: Rebuild shared and verify**

```bash
npm run build -w packages/shared
npm run dev
```

**Step 6: Commit**

```bash
git add packages/web/src/api/client.ts packages/web/src/hooks/useAnalysis.ts packages/web/src/components/Timeline.tsx packages/web/src/App.tsx
git commit -m "feat: frontend shows segments with per-segment retry UI"
```

---

## Task 9: Add chunk cleanup on upload

**Files:**
- Modify: `packages/api/src/routes/upload.ts`

**Step 1: Add cleanup function**

At the top of `packages/api/src/routes/upload.ts`, add:

```typescript
import { lt } from "drizzle-orm";

async function cleanupExpiredChunks() {
  const expired = await db
    .select({ id: analyses.id, chunksDir: analyses.chunksDir })
    .from(analyses)
    .where(lt(analyses.chunksExpireAt, new Date()));

  for (const row of expired) {
    if (row.chunksDir) {
      await fs.rm(row.chunksDir, { recursive: true, force: true }).catch(() => {});
      // Also try to remove parent workDir if empty
      const parentDir = path.dirname(row.chunksDir);
      await fs.rmdir(parentDir).catch(() => {});
    }
    await db.update(analyses)
      .set({ chunksDir: null, chunksExpireAt: null })
      .where(eq(analyses.id, row.id));
  }
}
```

Call it at the start of the upload handler:

```typescript
uploadRouter.post("/upload", upload.single("file"), async (req, res) => {
  // Opportunistic cleanup of expired chunks
  cleanupExpiredChunks().catch((err) => console.error("[cleanup]", err));

  // ... rest of handler
});
```

**Step 2: Commit**

```bash
git add packages/api/src/routes/upload.ts
git commit -m "feat: cleanup expired chunk files on new upload"
```

---

## Task 10: Remove debug logs and final cleanup

**Files:**
- Modify: `packages/api/src/services/acrcloud.ts` — remove `console.log("[acrcloud] response:", ...)`
- Modify: `packages/api/src/services/ffmpeg.ts` — remove `console.log("[rms] parsed...")`
- Modify: `packages/api/src/config.ts` — remove `console.log("[config] DATABASE_URL:", ...)`
- Modify: `packages/api/src/db/client.ts` — remove `console.log("[db] host:", ...)`

**Step 1: Remove all debug logs added during development**

**Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove debug logs, final cleanup"
```

---

## Summary of All Files Changed

**New files:**
- `packages/api/src/services/segments.ts`
- `packages/api/src/services/__tests__/segments.test.ts`
- `packages/api/src/services/__tests__/ffmpeg-overlap.test.ts`
- `packages/api/src/routes/retry.ts`
- `packages/api/src/workers/retry.worker.ts`
- `packages/api/src/db/migrations/0001_*.sql` (auto-generated)

**Modified files:**
- `packages/shared/src/types.ts` — new Segment types
- `packages/shared/src/constants.ts` — overlap constants
- `packages/api/src/db/schema.ts` — segments table + analyses columns
- `packages/api/src/services/ffmpeg.ts` — overlap splitting
- `packages/api/src/services/optimizer.ts` — chunkPositions parameter
- `packages/api/src/services/aggregator.ts` — (tests updated)
- `packages/api/src/workers/analysis.worker.ts` — save segments, keep chunks
- `packages/api/src/routes/analysis.ts` — return segments
- `packages/api/src/routes/upload.ts` — cleanup expired chunks
- `packages/api/src/queue/index.ts` — retry queue
- `packages/api/src/index.ts` — register retry router
- `packages/api/package.json` — worker:retry script
- `packages/web/src/api/client.ts` — retry API calls
- `packages/web/src/hooks/useAnalysis.ts` — segments state + retry
- `packages/web/src/components/Timeline.tsx` — segment-based UI with retry
- `packages/web/src/App.tsx` — pass segments/retry props
