# Mix Match Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app that identifies songs in uploaded DJ mixes using ACRCloud with 90%+ API cost optimization.

**Architecture:** Monorepo with shared types, Express API + BullMQ worker backend, React + Vite frontend. Worker processes audio through a 5-stage optimization pipeline (silence gate, early confirmation, fingerprint dedup, Redis cache, ACRCloud API) before aggregating results into a song timeline.

**Tech Stack:** TypeScript, Express, React, Vite, BullMQ, Redis, PostgreSQL, Drizzle ORM, FFmpeg, ACRCloud API

---

### Task 1: Monorepo Scaffold & Configuration

**Files:**
- Create: `package.json` (workspace root)
- Create: `tsconfig.base.json`
- Create: `docker-compose.yml`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "mix-match",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:api": "npm run dev -w packages/api",
    "dev:web": "npm run dev -w packages/web",
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:web\"",
    "build": "npm run build -w packages/shared && npm run build -w packages/api && npm run build -w packages/web"
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Step 3: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mix_match
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

**Step 4: Create .env.example**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mix_match
REDIS_URL=redis://localhost:6379
ACRCLOUD_HOST=identify-eu-west-1.acrcloud.com
ACRCLOUD_ACCESS_KEY=your_access_key
ACRCLOUD_ACCESS_SECRET=your_access_secret
UPLOAD_DIR=/tmp/mix-match
PORT=3001
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.wav
*.mp3
/tmp/
```

**Step 6: Create packages/shared/package.json and tsconfig.json**

```json
// packages/shared/package.json
{
  "name": "@mix-match/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 7: Create packages/api/package.json and tsconfig.json**

```json
// packages/api/package.json
{
  "name": "@mix-match/api",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "worker": "tsx src/workers/analysis.worker.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@mix-match/shared": "*",
    "bullmq": "^5.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "drizzle-orm": "^0.38.0",
    "express": "^4.21.0",
    "ioredis": "^5.4.0",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.13.0",
    "uuid": "^11.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "@types/uuid": "^10.0.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

```json
// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 8: Scaffold packages/web with Vite**

```bash
cd packages && npm create vite@latest web -- --template react-ts
```

Then add to `packages/web/package.json` dependencies:
```json
{
  "dependencies": {
    "@mix-match/shared": "*"
  }
}
```

**Step 9: Install all dependencies**

```bash
npm install
```

**Step 10: Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold monorepo with shared, api, and web packages"
```

---

### Task 2: Shared Types & Constants

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Create types.ts**

```typescript
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export interface TrackMatch {
  track: string;
  start: string; // "mm:ss"
  end: string;
}

export interface RawMatch {
  artist: string;
  title: string;
  acrid: string;
  album?: string;
  startSec: number;
}

export interface AnalysisResult {
  id: string;
  filename: string;
  fileSize: number;
  status: AnalysisStatus;
  totalChunks: number | null;
  processedChunks: number;
  results: TrackMatch[] | null;
  metrics: AnalysisMetrics | null;
  error: string | null;
  createdAt: string;
}

export interface AnalysisMetrics {
  totalChunks: number;
  silenceSkipped: number;
  coastSkipped: number;
  dedupSkipped: number;
  cacheHits: number;
  apiCalls: number;
  apiSavingsPercent: number;
  processingTimeMs: number;
  avgApiLatencyMs: number;
}

export interface ProgressEvent {
  type: "progress" | "completed" | "failed";
  chunksProcessed?: number;
  totalChunks?: number;
  currentTrack?: string;
  results?: TrackMatch[];
  error?: string;
}

export interface UploadResponse {
  analysisId: string;
}
```

**Step 2: Create constants.ts**

```typescript
export const CHUNK_DURATION_SEC = 15;
export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
export const SILENCE_THRESHOLD_DB = -40;
export const COAST_MODE_CONFIRM_COUNT = 3;
export const COAST_MODE_CHECK_INTERVAL = 4; // check every 4th chunk
export const FINGERPRINT_SIMILARITY_THRESHOLD = 0.85;
export const ACRCLOUD_RETRY_COUNT = 3;
export const ACRCLOUD_RETRY_BASE_DELAY_MS = 1000;
export const REDIS_FINGERPRINT_TTL = 30 * 24 * 60 * 60; // 30 days
export const REDIS_FILE_CACHE_TTL = 90 * 24 * 60 * 60; // 90 days
export const ALLOWED_MIMETYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
];
```

**Step 3: Create index.ts barrel export**

```typescript
export * from "./types.js";
export * from "./constants.js";
```

**Step 4: Build shared package**

```bash
npm run build -w packages/shared
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add shared types and constants"
```

---

### Task 3: Database Schema & Connection

**Files:**
- Create: `packages/api/src/db/schema.ts`
- Create: `packages/api/src/db/client.ts`
- Create: `packages/api/src/config.ts`
- Create: `packages/api/drizzle.config.ts`

**Step 1: Create config.ts**

```typescript
import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  acrcloud: {
    host: process.env.ACRCLOUD_HOST!,
    accessKey: process.env.ACRCLOUD_ACCESS_KEY!,
    accessSecret: process.env.ACRCLOUD_ACCESS_SECRET!,
  },
  uploadDir: process.env.UPLOAD_DIR || "/tmp/mix-match",
};
```

**Step 2: Create schema.ts**

```typescript
import { pgTable, uuid, varchar, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Step 3: Create client.ts**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

const pool = new pg.Pool({ connectionString: config.databaseUrl });
export const db = drizzle(pool, { schema });
```

**Step 4: Create drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 5: Start Docker services, generate and run migration**

```bash
docker compose up -d
npx drizzle-kit generate -w packages/api
npx drizzle-kit migrate -w packages/api
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add database schema, Drizzle config, and migrations"
```

---

### Task 4: BullMQ Queue Setup

**Files:**
- Create: `packages/api/src/queue/index.ts`

**Step 1: Create queue/index.ts**

```typescript
import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const analysisQueue = new Queue("analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 1, // worker handles ACRCloud retries internally
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const queueEvents = new QueueEvents("analysis", { connection: redis.duplicate() });
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add BullMQ queue setup with Redis connection"
```

---

### Task 5: Upload Route

**Files:**
- Create: `packages/api/src/routes/upload.ts`
- Create: `packages/api/src/index.ts`

**Step 1: Create upload.ts**

```typescript
import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { eq } from "drizzle-orm";
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from "@mix-match/shared";
import { db } from "../db/client.js";
import { analyses } from "../db/schema.js";
import { analysisQueue } from "../queue/index.js";
import { redis } from "../queue/index.js";
import { config } from "../config.js";

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

export const uploadRouter = Router();

uploadRouter.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    // SHA256 file hash for full-file cache
    const fileBuffer = await fs.readFile(file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Check file cache
    const cachedAnalysisId = await redis.get(`acr:file:${fileHash}`);
    if (cachedAnalysisId) {
      await fs.unlink(file.path);
      res.json({ analysisId: cachedAnalysisId });
      return;
    }

    // Create analysis record
    const [analysis] = await db
      .insert(analyses)
      .values({
        filename: file.originalname,
        fileSize: file.size,
        fileHash,
        status: "pending",
      })
      .returning({ id: analyses.id });

    // Enqueue job
    await analysisQueue.add("analyze", {
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
```

**Step 2: Create index.ts (Express app entry)**

```typescript
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { uploadRouter } from "./routes/upload.js";
import { analysisRouter } from "./routes/analysis.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", uploadRouter);
app.use("/api", analysisRouter);

app.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add upload route with file cache check and job enqueue"
```

---

### Task 6: Analysis Route + SSE

**Files:**
- Create: `packages/api/src/routes/analysis.ts`

**Step 1: Create analysis.ts**

```typescript
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { analyses } from "../db/schema.js";
import { queueEvents, analysisQueue } from "../queue/index.js";

export const analysisRouter = Router();

// GET /api/analysis/:id — poll result
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

  res.json(analysis);
});

// GET /api/analysis/:id/progress — SSE stream
analysisRouter.get("/analysis/:id/progress", async (req, res) => {
  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, req.params.id))
    .limit(1);

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  // If already done, send result immediately
  if (analysis.status === "completed" || analysis.status === "failed") {
    res.json(analysis);
    return;
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Listen for progress updates
  const onProgress = ({ jobId, data }: { jobId: string; data: unknown }) => {
    const progress = data as Record<string, unknown>;
    if (progress.analysisId === req.params.id) {
      send({ type: "progress", ...progress });
    }
  };

  const onCompleted = async ({ jobId }: { jobId: string }) => {
    const job = await analysisQueue.getJob(jobId);
    if (job?.data.analysisId === req.params.id) {
      const [updated] = await db
        .select()
        .from(analyses)
        .where(eq(analyses.id, req.params.id))
        .limit(1);
      send({ type: "completed", results: updated.results });
      cleanup();
      res.end();
    }
  };

  const onFailed = async ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    const job = await analysisQueue.getJob(jobId);
    if (job?.data.analysisId === req.params.id) {
      send({ type: "failed", error: failedReason });
      cleanup();
      res.end();
    }
  };

  const cleanup = () => {
    queueEvents.off("progress", onProgress);
    queueEvents.off("completed", onCompleted);
    queueEvents.off("failed", onFailed);
  };

  queueEvents.on("progress", onProgress);
  queueEvents.on("completed", onCompleted);
  queueEvents.on("failed", onFailed);

  req.on("close", cleanup);
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add analysis route with SSE progress streaming"
```

---

### Task 7: FFmpeg Service

**Files:**
- Create: `packages/api/src/services/ffmpeg.ts`
- Create: `packages/api/src/services/__tests__/ffmpeg.test.ts`

**Step 1: Write test for getDuration**

```typescript
import { describe, it, expect } from "vitest";
import { formatTimestamp } from "../ffmpeg.js";

describe("ffmpeg utils", () => {
  it("formats seconds to mm:ss", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(32)).toBe("00:32");
    expect(formatTimestamp(130)).toBe("02:10");
    expect(formatTimestamp(3661)).toBe("61:01");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && npx vitest run src/services/__tests__/ffmpeg.test.ts
```

**Step 3: Create ffmpeg.ts**

```typescript
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { CHUNK_DURATION_SEC } from "@mix-match/shared";

const exec = promisify(execFile);

/** Convert input audio to mono WAV 44100Hz */
export async function normalizeAudio(inputPath: string, outputPath: string): Promise<void> {
  await exec("ffmpeg", ["-i", inputPath, "-ac", "1", "-ar", "44100", "-f", "wav", "-y", outputPath]);
}

/** Get audio duration in seconds via ffprobe */
export async function getDuration(filePath: string): Promise<number> {
  const { stdout } = await exec("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

/** Split WAV into fixed-size chunks using segment muxer */
export async function splitIntoChunks(wavPath: string, outputDir: string): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const pattern = path.join(outputDir, "chunk_%04d.wav");
  await exec("ffmpeg", [
    "-i", wavPath,
    "-f", "segment",
    "-segment_time", String(CHUNK_DURATION_SEC),
    "-c", "copy",
    "-y",
    pattern,
  ]);

  const files = await fs.readdir(outputDir);
  return files
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
    .sort()
    .map((f) => path.join(outputDir, f));
}

/** Extract per-chunk RMS energy levels in a single FFmpeg pass */
export async function extractRmsLevels(wavPath: string, chunkCount: number): Promise<number[]> {
  const samplesPerChunk = 44100 * CHUNK_DURATION_SEC;
  const { stderr } = await exec("ffmpeg", [
    "-i", wavPath,
    "-af", `astats=metadata=1:reset=${samplesPerChunk}`,
    "-f", "null",
    "-",
  ]);

  const rmsValues: number[] = [];
  const lines = stderr.split("\n");
  for (const line of lines) {
    const match = line.match(/RMS level dB:\s*([-\d.]+)/);
    if (match) {
      rmsValues.push(parseFloat(match[1]));
    }
  }

  // astats outputs per-channel; we have mono so one value per reset window
  // If fewer values than chunks, pad with -Infinity (treat as silence)
  while (rmsValues.length < chunkCount) {
    rmsValues.push(-Infinity);
  }

  return rmsValues.slice(0, chunkCount);
}

/** Format seconds to mm:ss */
export function formatTimestamp(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/__tests__/ffmpeg.test.ts
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add FFmpeg service for normalize, split, RMS extraction"
```

---

### Task 8: ACRCloud Service

**Files:**
- Create: `packages/api/src/services/acrcloud.ts`
- Create: `packages/api/src/services/__tests__/acrcloud.test.ts`

**Step 1: Write test for signature generation**

```typescript
import { describe, it, expect } from "vitest";
import { buildSignature } from "../acrcloud.js";

describe("acrcloud", () => {
  it("generates valid HMAC-SHA1 signature", () => {
    const sig = buildSignature("GET\n/v1/identify\nkey\naudio\n1234567890", "secret");
    expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/); // base64
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/__tests__/acrcloud.test.ts
```

**Step 3: Create acrcloud.ts**

```typescript
import crypto from "crypto";
import fs from "fs/promises";
import { ACRCLOUD_RETRY_COUNT, ACRCLOUD_RETRY_BASE_DELAY_MS } from "@mix-match/shared";
import type { RawMatch } from "@mix-match/shared";
import { config } from "../config.js";

export function buildSignature(stringToSign: string, accessSecret: string): string {
  return crypto.createHmac("sha1", accessSecret).update(stringToSign).digest("base64");
}

export async function identifyChunk(chunkPath: string, startSec: number): Promise<RawMatch | null> {
  const fileBuffer = await fs.readFile(chunkPath);
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `POST\n/v1/identify\n${config.acrcloud.accessKey}\naudio\n${timestamp}`;
  const signature = buildSignature(stringToSign, config.acrcloud.accessSecret);

  const formData = new FormData();
  formData.append("access_key", config.acrcloud.accessKey);
  formData.append("sample_bytes", String(fileBuffer.length));
  formData.append("sample", new Blob([fileBuffer]), "chunk.wav");
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("data_type", "audio");
  formData.append("signature_version", "1");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < ACRCLOUD_RETRY_COUNT; attempt++) {
    try {
      const response = await fetch(`https://${config.acrcloud.host}/v1/identify`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.status?.code === 0 && data.metadata?.music?.length > 0) {
        const track = data.metadata.music[0];
        return {
          artist: track.artists?.map((a: { name: string }) => a.name).join(", ") || "Unknown",
          title: track.title || "Unknown",
          acrid: track.acrid || "",
          album: track.album?.name,
          startSec,
        };
      }

      // No match found — not an error
      if (data.status?.code === 1001) {
        return null;
      }

      // Rate limited or server error — retry
      if (data.status?.code >= 3000 || !response.ok) {
        throw new Error(`ACRCloud error: ${data.status?.msg || response.statusText}`);
      }

      return null;
    } catch (err) {
      lastError = err as Error;
      if (attempt < ACRCLOUD_RETRY_COUNT - 1) {
        const delay = ACRCLOUD_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/__tests__/acrcloud.test.ts
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add ACRCloud service with HMAC-SHA1 auth and retry logic"
```

---

### Task 9: Fingerprint Service

**Files:**
- Create: `packages/api/src/services/fingerprint.ts`
- Create: `packages/api/src/services/__tests__/fingerprint.test.ts`

**Step 1: Write test for fingerprint similarity**

```typescript
import { describe, it, expect } from "vitest";
import { hammingDistance, isSimilar } from "../fingerprint.js";

describe("fingerprint", () => {
  it("computes hamming distance between two buffers", () => {
    const a = Buffer.from([0b11110000, 0b10101010]);
    const b = Buffer.from([0b11110000, 0b10101010]);
    expect(hammingDistance(a, b)).toBe(0);
  });

  it("detects differing bits", () => {
    const a = Buffer.from([0b11110000]);
    const b = Buffer.from([0b11111111]);
    expect(hammingDistance(a, b)).toBe(4);
  });

  it("isSimilar returns true for identical fingerprints", () => {
    const fp = Buffer.from([0b11110000, 0b10101010]);
    expect(isSimilar(fp, fp, 0.85)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/__tests__/fingerprint.test.ts
```

**Step 3: Create fingerprint.ts**

```typescript
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import { FINGERPRINT_SIMILARITY_THRESHOLD } from "@mix-match/shared";

const exec = promisify(execFile);

/**
 * Generate a lightweight spectral fingerprint for an audio chunk.
 * Extracts raw PCM, computes simple spectral characteristics, and hashes them.
 * Returns a 16-byte (128-bit) fingerprint buffer.
 */
export async function generateFingerprint(chunkPath: string): Promise<Buffer> {
  // Extract raw PCM s16le samples
  const { stdout } = await exec(
    "ffmpeg",
    ["-i", chunkPath, "-f", "s16le", "-ac", "1", "-ar", "11025", "-"],
    { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 }
  );

  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, stdout.byteLength / 2);

  // Divide into 5 windows, compute energy peaks per window
  const windowSize = Math.floor(samples.length / 5);
  const peakData: number[] = [];

  for (let w = 0; w < 5; w++) {
    const start = w * windowSize;
    const end = Math.min(start + windowSize, samples.length);
    const window = samples.slice(start, end);

    // Simple spectral energy: divide window into 32 bands, sum squared amplitudes
    const bandSize = Math.floor(window.length / 32);
    const bands: number[] = [];
    for (let b = 0; b < 32; b++) {
      let energy = 0;
      for (let i = b * bandSize; i < (b + 1) * bandSize && i < window.length; i++) {
        energy += window[i] * window[i];
      }
      bands.push(energy);
    }

    // Pick top 5 band indices
    const topBands = bands
      .map((e, i) => ({ e, i }))
      .sort((a, b) => b.e - a.e)
      .slice(0, 5)
      .map((x) => x.i);

    peakData.push(...topBands);
  }

  // Hash peak data into 128-bit fingerprint
  return crypto.createHash("md5").update(Buffer.from(peakData)).digest();
}

/** Compute hamming distance between two equal-length buffers (count differing bits) */
export function hammingDistance(a: Buffer, b: Buffer): number {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = a[i] ^ b[i];
    while (xor) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/** Check if two fingerprints are similar within threshold (0-1 scale) */
export function isSimilar(a: Buffer, b: Buffer, threshold = FINGERPRINT_SIMILARITY_THRESHOLD): boolean {
  const totalBits = a.length * 8;
  const dist = hammingDistance(a, b);
  const similarity = 1 - dist / totalBits;
  return similarity >= threshold;
}
```

**Step 4: Run tests**

```bash
npx vitest run src/services/__tests__/fingerprint.test.ts
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add local audio fingerprint service with hamming distance"
```

---

### Task 10: Optimizer Service (5-Stage Pipeline)

**Files:**
- Create: `packages/api/src/services/optimizer.ts`

**Step 1: Create optimizer.ts**

```typescript
import {
  SILENCE_THRESHOLD_DB,
  COAST_MODE_CONFIRM_COUNT,
  COAST_MODE_CHECK_INTERVAL,
  REDIS_FINGERPRINT_TTL,
} from "@mix-match/shared";
import type { RawMatch, AnalysisMetrics } from "@mix-match/shared";
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

  // Coast mode state
  let currentTrackId: string | null = null;
  let consecutiveConfirms = 0;
  let coastMode = false;
  let chunksSinceLastCheck = 0;

  // Metrics
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
        // Assume same track continues
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

    // Cache the fingerprint result (even null matches)
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
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add 5-stage optimization pipeline for ACRCloud API savings"
```

---

### Task 11: Aggregator Service

**Files:**
- Create: `packages/api/src/services/aggregator.ts`
- Create: `packages/api/src/services/__tests__/aggregator.test.ts`

**Step 1: Write test**

```typescript
import { describe, it, expect } from "vitest";
import { aggregateMatches } from "../aggregator.js";

describe("aggregator", () => {
  it("merges consecutive identical matches", () => {
    const result = aggregateMatches([
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 30 },
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 45 },
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 60 },
      { artist: "Chemical Brothers", title: "Block Rockin Beats", acrid: "b", startSec: 75 },
    ]);

    expect(result).toEqual([
      { track: "Daft Punk - Around the World", start: "00:30", end: "01:15" },
      { track: "Chemical Brothers - Block Rockin Beats", start: "01:15", end: "01:30" },
    ]);
  });

  it("handles single match", () => {
    const result = aggregateMatches([
      { artist: "Artist", title: "Song", acrid: "x", startSec: 0 },
    ]);
    expect(result).toEqual([
      { track: "Artist - Song", start: "00:00", end: "00:15" },
    ]);
  });

  it("handles empty input", () => {
    expect(aggregateMatches([])).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/__tests__/aggregator.test.ts
```

**Step 3: Create aggregator.ts**

```typescript
import type { RawMatch, TrackMatch } from "@mix-match/shared";
import { CHUNK_DURATION_SEC } from "@mix-match/shared";
import { formatTimestamp } from "./ffmpeg.js";

export function aggregateMatches(raw: RawMatch[]): TrackMatch[] {
  if (raw.length === 0) return [];

  // Sort by startSec
  const sorted = [...raw].sort((a, b) => a.startSec - b.startSec);

  const timeline: TrackMatch[] = [];
  let current = sorted[0];
  let groupStart = current.startSec;
  let groupEnd = current.startSec + CHUNK_DURATION_SEC;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const sameTrack = next.artist === current.artist && next.title === current.title;

    if (sameTrack) {
      groupEnd = next.startSec + CHUNK_DURATION_SEC;
    } else {
      timeline.push({
        track: `${current.artist} - ${current.title}`,
        start: formatTimestamp(groupStart),
        end: formatTimestamp(groupEnd),
      });
      current = next;
      groupStart = next.startSec;
      groupEnd = next.startSec + CHUNK_DURATION_SEC;
    }
  }

  // Push last group
  timeline.push({
    track: `${current.artist} - ${current.title}`,
    start: formatTimestamp(groupStart),
    end: formatTimestamp(groupEnd),
  });

  return timeline;
}
```

**Step 4: Run tests**

```bash
npx vitest run src/services/__tests__/aggregator.test.ts
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add result aggregator with merge and dedup logic"
```

---

### Task 12: Analysis Worker

**Files:**
- Create: `packages/api/src/workers/analysis.worker.ts`

**Step 1: Create analysis.worker.ts**

```typescript
import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { REDIS_FILE_CACHE_TTL } from "@mix-match/shared";
import { config } from "../config.js";
import { redis } from "../queue/index.js";
import { db } from "../db/client.js";
import { analyses } from "../db/schema.js";
import { normalizeAudio, getDuration, splitIntoChunks, extractRmsLevels } from "../services/ffmpeg.js";
import { processChunksOptimized } from "../services/optimizer.js";
import { aggregateMatches } from "../services/aggregator.js";
import { CHUNK_DURATION_SEC } from "@mix-match/shared";

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
      // Update status to processing
      await db
        .update(analyses)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(analyses.id, analysisId));

      await fs.mkdir(workDir, { recursive: true });

      // Step 1: Normalize audio
      const wavPath = path.join(workDir, "normalized.wav");
      await normalizeAudio(filePath, wavPath);

      // Step 2: Get duration and calculate chunks
      const duration = await getDuration(wavPath);
      const totalChunks = Math.ceil(duration / CHUNK_DURATION_SEC);

      await db
        .update(analyses)
        .set({ totalChunks, updatedAt: new Date() })
        .where(eq(analyses.id, analysisId));

      // Step 3: Split into chunks
      const chunksDir = path.join(workDir, "chunks");
      const chunkPaths = await splitIntoChunks(wavPath, chunksDir);

      // Step 4: Extract RMS levels
      const rmsLevels = await extractRmsLevels(wavPath, totalChunks);

      // Step 5: Process through optimization pipeline
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

      // Step 6: Aggregate results
      const results = aggregateMatches(matches);

      // Step 7: Save results
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

      // Cache file hash for future re-uploads
      await redis.setex(`acr:file:${fileHash}`, REDIS_FILE_CACHE_TTL, analysisId);

      // Log metrics
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
      // Cleanup temp files
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
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add analysis worker with full processing pipeline"
```

---

### Task 13: Frontend — API Client & Hook

**Files:**
- Create: `packages/web/src/api/client.ts`
- Create: `packages/web/src/hooks/useAnalysis.ts`

**Step 1: Create api/client.ts**

```typescript
import type { UploadResponse, AnalysisResult } from "@mix-match/shared";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText || "Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export async function getAnalysis(id: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/analysis/${id}`);
  if (!res.ok) throw new Error("Failed to fetch analysis");
  return res.json();
}

export function subscribeProgress(
  id: string,
  onEvent: (data: Record<string, unknown>) => void,
  onError?: (err: Error) => void
): () => void {
  const es = new EventSource(`${API_BASE}/analysis/${id}/progress`);

  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // ignore parse errors
    }
  };

  es.onerror = () => {
    onError?.(new Error("SSE connection lost"));
    es.close();
  };

  return () => es.close();
}
```

**Step 2: Create hooks/useAnalysis.ts**

```typescript
import { useState, useCallback, useEffect, useRef } from "react";
import type { TrackMatch, ProgressEvent } from "@mix-match/shared";
import { uploadFile, subscribeProgress, getAnalysis } from "../api/client";

type Phase = "idle" | "uploading" | "processing" | "completed" | "failed";

interface AnalysisState {
  phase: Phase;
  analysisId: string | null;
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  results: TrackMatch[] | null;
  error: string | null;
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    phase: "idle",
    analysisId: null,
    uploadProgress: 0,
    chunksProcessed: 0,
    totalChunks: 0,
    currentTrack: null,
    results: null,
    error: null,
  });

  const cleanupRef = useRef<(() => void) | null>(null);

  const startAnalysis = useCallback(async (file: File) => {
    setState((s) => ({ ...s, phase: "uploading", uploadProgress: 0, error: null, results: null }));

    try {
      const { analysisId } = await uploadFile(file, (pct) => {
        setState((s) => ({ ...s, uploadProgress: pct }));
      });

      setState((s) => ({ ...s, phase: "processing", analysisId, uploadProgress: 100 }));

      // Subscribe to SSE progress
      const unsub = subscribeProgress(
        analysisId,
        (data) => {
          if (data.type === "progress") {
            setState((s) => ({
              ...s,
              chunksProcessed: (data.chunksProcessed as number) || s.chunksProcessed,
              totalChunks: (data.totalChunks as number) || s.totalChunks,
              currentTrack: (data.currentTrack as string) || s.currentTrack,
            }));
          } else if (data.type === "completed") {
            setState((s) => ({
              ...s,
              phase: "completed",
              results: data.results as TrackMatch[],
            }));
          } else if (data.type === "failed") {
            setState((s) => ({
              ...s,
              phase: "failed",
              error: (data.error as string) || "Analysis failed",
            }));
          }
        },
        (err) => {
          // On SSE error, fall back to polling
          pollResult(analysisId);
        }
      );

      cleanupRef.current = unsub;
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "failed",
        error: err instanceof Error ? err.message : "Upload failed",
      }));
    }
  }, []);

  const pollResult = useCallback(async (id: string) => {
    try {
      const result = await getAnalysis(id);
      if (result.status === "completed") {
        setState((s) => ({ ...s, phase: "completed", results: result.results as TrackMatch[] }));
      } else if (result.status === "failed") {
        setState((s) => ({ ...s, phase: "failed", error: result.error || "Failed" }));
      } else {
        setTimeout(() => pollResult(id), 3000);
      }
    } catch {
      setTimeout(() => pollResult(id), 5000);
    }
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setState({
      phase: "idle",
      analysisId: null,
      uploadProgress: 0,
      chunksProcessed: 0,
      totalChunks: 0,
      currentTrack: null,
      results: null,
      error: null,
    });
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return { ...state, startAnalysis, reset };
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add frontend API client and useAnalysis hook with SSE"
```

---

### Task 14: Frontend — Components

**Files:**
- Create: `packages/web/src/components/FileUpload.tsx`
- Create: `packages/web/src/components/ProgressBar.tsx`
- Create: `packages/web/src/components/Timeline.tsx`
- Modify: `packages/web/src/App.tsx`
- Create: `packages/web/src/App.css`

**Step 1: Create FileUpload.tsx**

```tsx
import { useCallback, useRef, useState, type DragEvent } from "react";
import { MAX_FILE_SIZE, ALLOWED_MIMETYPES } from "@mix-match/shared";

interface Props {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelected, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
    if (!ALLOWED_MIMETYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a)$/i)) {
      return "Unsupported file type. Use MP3, WAV, FLAC, or M4A.";
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onFileSelected(file);
  }, [onFileSelected]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`upload-zone ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,.m4a"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        hidden
      />
      <p className="upload-icon">🎵</p>
      <p>Drop your DJ mix here or click to browse</p>
      <p className="upload-hint">MP3, WAV, FLAC, M4A — up to 200MB</p>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}
```

**Step 2: Create ProgressBar.tsx**

```tsx
interface Props {
  phase: "uploading" | "processing";
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
}

export function ProgressBar({ phase, uploadProgress, chunksProcessed, totalChunks, currentTrack }: Props) {
  const pct = phase === "uploading"
    ? uploadProgress
    : totalChunks > 0
      ? Math.round((chunksProcessed / totalChunks) * 100)
      : 0;

  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-label">
        {phase === "uploading"
          ? `Uploading... ${pct}%`
          : `Analyzing... chunk ${chunksProcessed} of ${totalChunks}`}
      </p>
      {currentTrack && <p className="progress-track">Now detecting: {currentTrack}</p>}
    </div>
  );
}
```

**Step 3: Create Timeline.tsx**

```tsx
import type { TrackMatch } from "@mix-match/shared";

interface Props {
  results: TrackMatch[];
  onReset: () => void;
}

export function Timeline({ results, onReset }: Props) {
  return (
    <div className="timeline">
      <div className="timeline-header">
        <h2>Detected {results.length} track{results.length !== 1 ? "s" : ""}</h2>
        <button onClick={onReset} className="btn-reset">Analyze another mix</button>
      </div>
      <div className="timeline-list">
        {results.map((t, i) => (
          <div key={i} className="timeline-item">
            <div className="timeline-time">
              <span>{t.start}</span>
              <span className="timeline-dash">—</span>
              <span>{t.end}</span>
            </div>
            <div className="timeline-track">{t.track}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Update App.tsx**

```tsx
import { useAnalysis } from "./hooks/useAnalysis";
import { FileUpload } from "./components/FileUpload";
import { ProgressBar } from "./components/ProgressBar";
import { Timeline } from "./components/Timeline";
import "./App.css";

function App() {
  const { phase, uploadProgress, chunksProcessed, totalChunks, currentTrack, results, error, startAnalysis, reset } =
    useAnalysis();

  return (
    <div className="app">
      <header>
        <h1>Mix Match</h1>
        <p>Upload a DJ mix and identify every track</p>
      </header>

      <main>
        {phase === "idle" && <FileUpload onFileSelected={startAnalysis} />}

        {(phase === "uploading" || phase === "processing") && (
          <ProgressBar
            phase={phase}
            uploadProgress={uploadProgress}
            chunksProcessed={chunksProcessed}
            totalChunks={totalChunks}
            currentTrack={currentTrack}
          />
        )}

        {phase === "completed" && results && <Timeline results={results} onReset={reset} />}

        {phase === "failed" && (
          <div className="error-state">
            <p>Analysis failed: {error}</p>
            <button onClick={reset} className="btn-reset">Try again</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
```

**Step 5: Create App.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0a0a0f;
  color: #e0e0e0;
  min-height: 100vh;
}

.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  text-align: center;
  margin-bottom: 3rem;
}

header h1 { font-size: 2rem; color: #fff; }
header p { color: #888; margin-top: 0.5rem; }

.upload-zone {
  border: 2px dashed #333;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.upload-zone:hover, .upload-zone.drag-over {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.05);
}

.upload-icon { font-size: 3rem; margin-bottom: 1rem; }
.upload-hint { color: #666; font-size: 0.85rem; margin-top: 0.5rem; }
.upload-error { color: #ef4444; margin-top: 0.75rem; }

.progress-container { text-align: center; }

.progress-bar {
  height: 8px;
  background: #1a1a2e;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: #6366f1;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-label { color: #ccc; }
.progress-track { color: #6366f1; margin-top: 0.5rem; font-size: 0.9rem; }

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.timeline-list { display: flex; flex-direction: column; gap: 0.75rem; }

.timeline-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem;
  background: #111122;
  border-radius: 8px;
  border-left: 3px solid #6366f1;
}

.timeline-time {
  font-family: monospace;
  font-size: 0.85rem;
  color: #888;
  white-space: nowrap;
  min-width: 120px;
}

.timeline-dash { margin: 0 0.25rem; }
.timeline-track { font-weight: 500; }

.btn-reset {
  background: #1a1a2e;
  color: #ccc;
  border: 1px solid #333;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}

.btn-reset:hover { border-color: #6366f1; }

.error-state { text-align: center; }
.error-state p { color: #ef4444; margin-bottom: 1rem; }
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add frontend components — FileUpload, ProgressBar, Timeline"
```

---

### Task 15: Vite Proxy & Dev Setup

**Files:**
- Modify: `packages/web/vite.config.ts`

**Step 1: Update vite.config.ts to proxy API requests**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

**Step 2: Update packages/web/src/api/client.ts API_BASE to use relative path in dev**

Change:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
```
To:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || "/api";
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Vite proxy config for API and relative API path"
```

---

### Task 16: End-to-End Smoke Test

**Step 1: Start Docker services**

```bash
docker compose up -d
```

**Step 2: Run database migrations**

```bash
cd packages/api && npx drizzle-kit migrate
```

**Step 3: Create .env from .env.example**

```bash
cp .env.example .env
# Edit .env with real ACRCloud credentials
```

**Step 4: Start API server in one terminal**

```bash
npm run dev:api
```

**Step 5: Start worker in another terminal**

```bash
npm run worker -w packages/api
```

**Step 6: Start frontend in another terminal**

```bash
npm run dev:web
```

**Step 7: Upload a short test audio file via the UI and verify:**

- File uploads successfully
- Progress updates appear via SSE
- Timeline renders with detected tracks
- Metrics are logged in worker terminal

**Step 8: Commit any fixes**

```bash
git add -A && git commit -m "chore: fix any issues found during smoke test"
```
