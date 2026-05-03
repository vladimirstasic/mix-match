# Codebase Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refaktorisati MixMatch codebase — eliminisati duplikacije, poboljšati error handling, razdvojiti odgovornosti, dodati type safety.

**Architecture:** Izvlačimo ponovljenu logiku u helper-e/middleware, razbijamo velike fajlove, dodajemo error boundary i konsistentan error handling.

**Tech Stack:** Express, React, Drizzle ORM, TypeScript

---

### Task 1: Izvuci DB helper-e (eliminiši duplikaciju upita)

**Files:**
- Create: `packages/api/src/db/helpers.ts`
- Modify: `packages/api/src/routes/analysis.ts`
- Modify: `packages/api/src/routes/upload.ts`
- Modify: `packages/api/src/routes/retry.ts`

**Šta:** Pattern `db.select().from(analyses).where(eq(analyses.id, id)).limit(1)` se ponavlja 20+ puta. Izvuci u:

```typescript
// db/helpers.ts
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { analyses, segments } from "./schema.js";

export async function findAnalysis(id: string) {
  const [row] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
  return row ?? null;
}

export async function findSegment(id: string) {
  const [row] = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
  return row ?? null;
}

export async function getAnalysisSegments(analysisId: string) {
  return db.select().from(segments)
    .where(eq(segments.analysisId, analysisId))
    .orderBy(segments.startSec);
}
```

Zameni sve rucne upite sa pozivima ovih helpera u svim route fajlovima.

**Commit:** `refactor: extract DB query helpers to reduce duplication`

---

### Task 2: Auth middleware + ownership check

**Files:**
- Create: `packages/api/src/middleware/auth.ts`
- Modify: `packages/api/src/routes/upload.ts`
- Modify: `packages/api/src/routes/analysis.ts`
- Modify: `packages/api/src/routes/retry.ts`

**Šta:** Auth check `if (!userId) { res.status(401)... }` i ownership check se ponavljaju. Izvuci:

```typescript
// middleware/auth.ts
import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}
```

Primeni na svim protected rutama umesto manuelnog `getAuth` + check.

**Commit:** `refactor: extract auth middleware for consistent auth checks`

---

### Task 3: Razbij upload.ts — izvuci yt-dlp i cleanup

**Files:**
- Create: `packages/api/src/services/download.ts`
- Create: `packages/api/src/services/cleanup.ts`
- Modify: `packages/api/src/routes/upload.ts`

**Šta:**
- `cleanupExpiredChunks()` → `services/cleanup.ts`
- yt-dlp logika (title + download) → `services/download.ts`
- upload.ts ostaje čist: validacija → helper pozivi → enqueue

```typescript
// services/download.ts
export async function downloadAudio(url: string, outputDir: string): Promise<{ filePath: string; title: string }> { ... }

// services/cleanup.ts
export async function cleanupExpiredChunks(): Promise<void> { ... }
```

**Commit:** `refactor: extract download and cleanup services from upload route`

---

### Task 4: Razbij analysis.ts — odvoji export rute

**Files:**
- Create: `packages/api/src/routes/export.ts`
- Modify: `packages/api/src/routes/analysis.ts`
- Modify: `packages/api/src/index.ts`

**Šta:** analysis.ts ima 288 linija sa 8 ruta. Izvuci 3 export endpointa + formatTime helper u zaseban fajl. Takođe obriši dupli `formatTime`/`formatTimestamp` — koristi jedan iz ffmpeg.ts.

```typescript
// routes/export.ts
import { Router } from "express";
import { formatTimestamp } from "../services/ffmpeg.js";
// ... export endpoints
export const exportRouter = Router();
```

Registruj u index.ts: `app.use("/api", exportRouter);`

**Commit:** `refactor: split export routes from analysis.ts`

---

### Task 5: Razbij useAnalysis hook

**Files:**
- Create: `packages/web/src/hooks/useAnalysisProgress.ts`
- Modify: `packages/web/src/hooks/useAnalysis.ts`

**Šta:** useAnalysis je 241 linija sa 7 callback-ova. Izvuci SSE subscription logiku koja se ponavlja u `startAnalysis` i `startAnalysisFromUrl`:

```typescript
// hooks/useAnalysisProgress.ts
export function subscribeToProgress(
  analysisId: string,
  setState: React.Dispatch<...>,
  pollResult: (id: string) => void,
  cleanupRef: React.MutableRefObject<...>
) { ... }
```

Takođe izvuci magic numbers u konstante:
```typescript
const POLL_INTERVAL_MS = 3000;
const POLL_RETRY_MS = 5000;
const RETRY_POLL_MS = 2000;
```

**Commit:** `refactor: extract SSE subscription logic from useAnalysis hook`

---

### Task 6: Razbij Timeline komponentu

**Files:**
- Create: `packages/web/src/components/SegmentCard.tsx`
- Create: `packages/web/src/components/SpotifyEmbed.tsx`
- Modify: `packages/web/src/components/Timeline.tsx`

**Šta:** Timeline je 321 linija. Izvuci:
- `SegmentCard` — renderuje jedan segment (identified/unknown/retrying) sa svim akcijama
- `SpotifyEmbed` / `DeezerEmbed` — iframe embed logika

Timeline ostaje kao kontejner: header, lista SegmentCard-ova, export/share sekcija.

**Commit:** `refactor: extract SegmentCard and embed components from Timeline`

---

### Task 7: Error handling — Express error middleware + API error klasa

**Files:**
- Create: `packages/api/src/middleware/errorHandler.ts`
- Create: `packages/api/src/errors.ts`
- Modify: `packages/api/src/index.ts`
- Modify: sve route fajlove (zameni `throw err` sa `next(err)`)

**Šta:** Dodaj centralizovan error handler:

```typescript
// errors.ts
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
export class NotFoundError extends AppError { constructor(msg = "Not found") { super(404, msg); } }
export class UnauthorizedError extends AppError { constructor(msg = "Unauthorized") { super(401, msg); } }

// middleware/errorHandler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Internal server error" });
}
```

Registruj u index.ts kao poslednji middleware. Zameni sve `.catch(() => {})` sa `.catch(err => console.error("[cleanup]", err))`.

**Commit:** `refactor: add centralized error handling middleware`

---

### Task 8: Konstante — eliminiši magic strings i numbers

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: fajlove koji koriste hardkodirane vrednosti

**Šta:** Dodaj:
```typescript
export const REDIS_KEY_PREFIX_FILE = "acr:file:";
export const REDIS_KEY_PREFIX_FP = "acr:fp:";
export const ANALYSIS_MODES = { FAST: "fast", DETAILED: "detailed" } as const;
```

Zameni sve `"acr:file:"`, `"fast"`, `"detailed"` hardkodirane stringove sa konstantama.

**Commit:** `refactor: extract magic strings and numbers to constants`

---

### Task 9: Frontend Error Boundary

**Files:**
- Create: `packages/web/src/components/ErrorBoundary.tsx`
- Modify: `packages/web/src/main.tsx`

**Šta:** Dodaj React Error Boundary oko App-a:
```tsx
class ErrorBoundary extends React.Component<PropsWithChildren, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <div>Something went wrong. <button onClick={() => this.setState({ error: null })}>Try again</button></div>;
    return this.props.children;
  }
}
```

**Commit:** `refactor: add error boundary for graceful crash recovery`

---

### Task 10: Ukloni dead code i fixuj unused imports

**Files:**
- Modify: `packages/api/src/services/ffmpeg.ts` — ukloni unused `chunkCount` param
- Modify: `packages/api/src/workers/analysis.worker.ts` — ukloni dupli `wavPath2`
- Prođi kroz sve fajlove i ukloni nekorišćene importove

**Commit:** `chore: remove dead code and unused imports`

---

## Verifikacija

Nakon svakog taska:
1. `npx tsc --noEmit -p packages/api/tsconfig.json` — API kompajlira
2. `npx tsc --noEmit -p packages/web/tsconfig.app.json` — Web kompajlira
3. `npx vitest run` — svi testovi prolaze
4. Manuelni test: upload mix → rezultati se prikazuju → edit/export/share rade
