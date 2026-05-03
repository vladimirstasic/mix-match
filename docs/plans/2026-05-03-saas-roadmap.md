# MixMatch SaaS — Product Roadmap & Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformisati MixMatch iz proof-of-concept u polished SaaS proizvod sa persistence, user library, i viral mechanics.

**Architecture:** Inkrementalne promene na postojećoj Express + React + PostgreSQL arhitekturi. Fokus na persistence layer, user dashboard, i shareable pages.

**Tech Stack:** Existing (Express, React, Drizzle, BullMQ, Clerk, ACRCloud) + React Router za multi-page

---

## Prioritizacija: Impact vs Effort Matrix

### MVP (Ove nedelje) — Must Have za lansiranje
| # | Feature | Impact | Effort | Oblast |
|---|---------|--------|--------|--------|
| 1 | Persistence — sačuvaj rezultate u bazi, preživi refresh | CRITICAL | 2h | Persistence |
| 2 | User Dashboard — "Moji mixevi" lista | HIGH | 2h | User Library |
| 3 | Public Tracklist Viewer — /t/:slug stranica | HIGH | 1h | Viral |
| 4 | Copy tracklist to clipboard | HIGH | 15min | UX |

### V1.1 (Sledeća nedelja) — Polished Experience
| # | Feature | Impact | Effort | Oblast |
|---|---------|--------|--------|--------|
| 5 | Spotify Playlist Export | HIGH | 2h | Viral |
| 6 | YouTube Chapter Export | MEDIUM | 30min | Creator |
| 7 | Search/Filter u rezultatima | MEDIUM | 1h | UX |
| 8 | Processing notifications (email/toast) | MEDIUM | 1h | UX |

### V2 (Posle lansiranja) — Growth & Moat
| Feature | Oblast |
|---------|--------|
| BPM/Key detection (essentia.js ili browser audio analysis) | Audio Intelligence |
| Waveform vizualizacija | Timeline UX |
| Community corrections + upvote | Network Effects |
| DJ profil stranice | Creator |
| Spotify playlist import ("prepoznaj ove pesme u mom mixu") | Smart Features |
| AI summary ("Dark techno mix sa peak-om u sredini") | AI Layer |

### Long-term Vision
| Feature | Oblast |
|---------|--------|
| Proprietary dataset od crowd-validated ID-jeva | Data Moat |
| White-label API za radio stanice | Enterprise |
| Trend detection ("ovaj track raste u mixevima") | Intelligence |
| DJ style fingerprinting | AI |

---

## MVP Implementation Plan

### Task 1: Persistence — Rezultati preživljavaju refresh

**Problem:** Korisnik refreshuje stranicu → sve nestaje. Analysis postoji u bazi ali frontend nema mehanizam da ga povrati.

**Files:**
- Modify: `packages/web/src/hooks/useAnalysis.ts`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/api/src/routes/analysis.ts`

**Rešenje:** Čuvaj `analysisId` u `localStorage`. Na mount, proveri da li postoji aktivan analysis i učitaj ga.

**Step 1:** U `useAnalysis.ts`, kad dobiješ `analysisId` (posle uploada), sačuvaj u localStorage:
```typescript
localStorage.setItem("mixmatch_active_analysis", analysisId);
```

**Step 2:** Na mount (useEffect), proveri localStorage:
```typescript
useEffect(() => {
  const savedId = localStorage.getItem("mixmatch_active_analysis");
  if (savedId && state.phase === "idle") {
    // Fetch analysis from API
    getAnalysis(savedId).then((data) => {
      if (data.status === "completed") {
        setState(s => ({ ...s, phase: "completed", analysisId: savedId, segments: data.segments, ... }));
      } else if (data.status === "processing") {
        setState(s => ({ ...s, phase: "processing", analysisId: savedId }));
        // Re-subscribe to SSE
      }
    }).catch(() => {
      localStorage.removeItem("mixmatch_active_analysis");
    });
  }
}, []);
```

**Step 3:** Na `reset()`, obriši iz localStorage:
```typescript
localStorage.removeItem("mixmatch_active_analysis");
```

**Commit:** `feat: persist active analysis across page refreshes`

---

### Task 2: User Dashboard — "Moji Mixevi"

**Files:**
- Create: `packages/web/src/components/Dashboard.tsx`
- Create: `packages/api/src/routes/user.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/hooks/useAnalysis.ts`
- Modify: `packages/web/src/api/client.ts`

**Backend — novi endpoint:**

`GET /api/user/analyses` — vraća sve analize korisnika, sortirane po datumu:

```typescript
// routes/user.ts
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { analyses } from "../db/schema.js";

export const userRouter = Router();

userRouter.get("/user/analyses", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select({
    id: analyses.id,
    filename: analyses.filename,
    status: analyses.status,
    createdAt: analyses.createdAt,
    isPublic: analyses.isPublic,
    slug: analyses.slug,
  })
  .from(analyses)
  .where(eq(analyses.userId, userId))
  .orderBy(desc(analyses.createdAt))
  .limit(50);

  res.json(rows);
});
```

Registruj u `index.ts`: `app.use("/api", userRouter);`

**Frontend — Dashboard komponenta:**

```tsx
// components/Dashboard.tsx
// Prikazuje listu prethodnih analiza
// Svaka ima: filename, datum, status badge, "Open" dugme
// Klik na "Open" → učitaj tu analizu u useAnalysis state
// "New Analysis" dugme na vrhu
```

**App.tsx flow:**
- Kad je ulogovan i `phase === "idle"` → prikaži Dashboard + FileUpload
- Dashboard lista se pojavi iznad upload zone
- Klik na prethodnu analizu → učitaj rezultate

**Commit:** `feat: add user dashboard with analysis history`

---

### Task 3: Public Tracklist Viewer — /t/:slug

**Problem:** Share link generiše URL ali nema stranicu za prikaz.

**Files:**
- Create: `packages/web/src/components/PublicTracklist.tsx`
- Modify: `packages/web/src/App.tsx` (dodaj routing)
- Install: `react-router-dom`

**Rešenje:** Dodaj React Router sa dve rute:
- `/` → glavna app (upload, dashboard, results)
- `/t/:slug` → public tracklist viewer (read-only, bez auth)

**PublicTracklist.tsx:**
```tsx
// Fetch GET /api/t/:slug
// Prikaži: mix naziv, lista pesama sa timestampovima, streaming linkovi
// Footer: "Powered by MixMatch — Analyze your own mix" CTA
// Bez edit/retry/export — samo pregled
// OG meta tags za social sharing (title, description)
```

**Commit:** `feat: add public tracklist viewer at /t/:slug`

---

### Task 4: Copy Tracklist to Clipboard

**Files:**
- Modify: `packages/web/src/components/Timeline.tsx`

**Rešenje:** Dodaj "Copy" dugme pored Export dugmadi. Na klik:

```typescript
const text = segments
  .filter(s => s.status === "identified")
  .map((s, i) => `${i + 1}. ${formatTime(s.startSec)} - ${formatTime(s.endSec)}  ${s.trackName}`)
  .join("\n");
navigator.clipboard.writeText(text);
// Show toast "Copied!"
```

Dodaj i "Copy as YouTube chapters" format:
```
00:00 First Track
05:30 Second Track
```

**Commit:** `feat: copy tracklist to clipboard (text + YouTube chapters)`

---

## Verifikacija

Nakon svakog taska:
1. `npx tsc --noEmit` — kompajlira se
2. `npx vitest run` — testovi prolaze
3. Manuelni test:
   - Task 1: Upload mix → refresh → rezultati su tu
   - Task 2: Vidi listu prethodnih analiza, klikni jednu
   - Task 3: Otvori /t/:slug u incognito → vidi tracklist
   - Task 4: Copy dugme kopira tekst u clipboard
