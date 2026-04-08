# Mix Detective — Design Document

A web app that identifies songs in uploaded DJ mixes using ACRCloud, with aggressive API cost optimization.

## Architecture

```
[React + Vite Frontend]
    │
    ├── POST /upload          (multipart, max 200MB)
    ├── GET /analysis/:id     (poll results)
    └── GET /analysis/:id/progress  (SSE stream)
    │
[Express API Server]
    │
    ├── Multer → /tmp/mix-detective/
    ├── PostgreSQL (Drizzle ORM)
    └── BullMQ queue → Redis
            │
[Analysis Worker]
    │
    ├── FFmpeg normalize (mono, 44100Hz WAV)
    ├── FFmpeg single-pass chunk split (15s segments)
    ├── 5-Stage Optimization Pipeline:
    │   1. Silence gate (RMS < -40dB → skip)
    │   2. Early confirmation (3 consecutive same → coast mode, check every 4th)
    │   3. Local fingerprint dedup (spectral peak hash, hamming distance)
    │   4. Redis cache lookup (acr:fp:{hash})
    │   5. ACRCloud API call (with retry + backoff)
    ├── Result aggregator (merge adjacent, dedupe)
    └── Save results + metrics to PostgreSQL
```

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Queue:** BullMQ + Redis
- **Audio:** FFmpeg / ffprobe
- **Recognition:** ACRCloud `/v1/identify`
- **Progress:** Server-Sent Events (SSE)

## Monorepo Structure

```
mix-detective/
├── packages/
│   ├── shared/              # Types & constants
│   │   └── src/
│   │       ├── types.ts
│   │       └── constants.ts
│   ├── api/                 # Backend
│   │   └── src/
│   │       ├── index.ts
│   │       ├── config.ts
│   │       ├── routes/
│   │       │   ├── upload.ts
│   │       │   └── analysis.ts
│   │       ├── workers/
│   │       │   └── analysis.worker.ts
│   │       ├── services/
│   │       │   ├── ffmpeg.ts
│   │       │   ├── acrcloud.ts
│   │       │   ├── fingerprint.ts
│   │       │   ├── optimizer.ts
│   │       │   └── aggregator.ts
│   │       ├── db/
│   │       │   ├── client.ts
│   │       │   ├── schema.ts
│   │       │   └── migrations/
│   │       └── queue/
│   │           └── index.ts
│   └── web/                 # Frontend
│       └── src/
│           ├── App.tsx
│           ├── components/
│           │   ├── FileUpload.tsx
│           │   ├── ProgressBar.tsx
│           │   └── Timeline.tsx
│           ├── hooks/
│           │   └── useAnalysis.ts
│           └── api/
│               └── client.ts
├── docker-compose.yml
├── package.json
└── tsconfig.base.json
```

## Database Schema

```sql
CREATE TABLE analyses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename         VARCHAR(255) NOT NULL,
    file_size        INTEGER NOT NULL,
    file_hash        VARCHAR(64),          -- SHA256 for full-file cache
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_chunks     INTEGER,
    processed_chunks INTEGER DEFAULT 0,
    results          JSONB,                -- final aggregated timeline
    metrics          JSONB,                -- optimization stats
    error            TEXT,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);
```

## Redis Keys

```
acr:fp:{fingerprint_hash}  →  { artist, title, acrid, album }   TTL: 30d
acr:file:{sha256}           →  { analysisId }                    TTL: 90d
acr:ratelimit               →  token bucket                      TTL: 1s
```

## Worker Pipeline

```
1. Receive job { analysisId, filePath }
2. SHA256 hash check → if cached, return immediately
3. FFmpeg normalize: ffmpeg -i input.mp3 -ac 1 -ar 44100 -f wav output.wav
4. Get duration via ffprobe → set totalChunks
5. Single-pass split: ffmpeg -i output.wav -f segment -segment_time 15 -c copy chunks/chunk_%04d.wav
6. Single-pass RMS: ffmpeg -i output.wav -af astats=metadata=1:reset=661500 -f null -
7. For each chunk:
     a. Silence gate: RMS < -40dB → skip
     b. Early confirm: same track 3x → coast mode (check every 4th)
     c. Fingerprint dedup: compute spectral peak hash → compare to seen hashes
     d. Redis cache: lookup fingerprint hash → return if hit
     e. ACRCloud API: POST /v1/identify (retry 3x, exponential backoff)
     f. Store result, update fingerprint cache
     g. job.updateProgress({ processed, total, currentTrack })
8. Aggregator: merge adjacent identical matches, set end times
9. Save results + metrics to DB, status = completed
10. Clean up temp files
```

## Optimization Targets

For a 60-minute mix (240 naive chunks):

| Stage | Savings |
|-------|---------|
| Silence gate | ~15% skipped |
| Early confirmation | ~40-50% skipped |
| Fingerprint dedup | ~15-20% skipped |
| Redis cache | grows over time |
| **Total** | **~78-90% fewer API calls** |

Target: 20-60 API calls per 60-min mix instead of 240.

## SSE Progress Events

```typescript
// Event types sent to client
{ type: "progress", chunksProcessed: 12, totalChunks: 240, currentTrack: "Artist - Title" }
{ type: "completed", results: [...] }
{ type: "failed", error: "..." }
```

## Output Format

```json
[
  {
    "track": "Artist - Title",
    "start": "00:32",
    "end": "02:10"
  }
]
```

## Metrics Logged Per Job

```json
{
  "totalChunks": 240,
  "silenceSkipped": 36,
  "coastSkipped": 98,
  "dedupSkipped": 31,
  "cacheHits": 22,
  "apiCalls": 53,
  "apiSavingsPercent": 77.9,
  "processingTimeMs": 48200,
  "avgApiLatencyMs": 340
}
```
