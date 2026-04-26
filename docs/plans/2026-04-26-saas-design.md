# MixMatch SaaS — Design Document

> Date: 2026-04-26
> Status: Draft

## Vision

MixMatch je SaaS za DJ-eve i radio producente koji automatski prepoznaje pesme u DJ mixevima i generiše tracklist. Korisnik uploaduje mix, dobije tracklist sa timestampovima, može editovati, exportovati za Mixcloud/SoundCloud, i podeliti kao javnu stranicu.

## Target korisnik

DJ-evi i radio producenti koji:
- Moraju da prijave tracklist za copyright/royalties
- Žele da podele tracklist sa fanovima
- Nemaju vremena da ručno pišu tracklist za 2h mix

## Ključne funkcije

1. **Audio recognition** — uploaduj mix, dobij tracklist (Fast/Detailed mode)
2. **Manual edit** — ispravi pogrešno prepoznate pesme
3. **Export** — Mixcloud, SoundCloud, 1001tracklists, plain text format
4. **Streaming linkovi** — Spotify/Beatport/Apple Music za svaku pesmu
5. **Shareable page** — javna stranica sa custom URL (mixmatch.app/t/abc123)

## Pricing (definisati tačno pre lansiranja)

- **Free:** 3 mixa/mesec, Fast mode, watermark
- **Pro (~$9.99/mo):** 30 mixeva, oba moda, export, share, bez watermark-a
- **Studio (~$29.99/mo):** Unlimited, API pristup, bulk upload

## Tech Stack

| Komponenta | Tehnologija | Zašto |
|---|---|---|
| Frontend | React + Vite (postojeći) | Već implementirano |
| Hosting FE | Vercel | Free tier, brz deploy |
| Backend | Express + BullMQ (postojeći) | Već implementirano |
| Hosting BE | Railway ili Fly.io | Persistent workers, affordable |
| Auth | Clerk | Google/GitHub/Email OOTB, free <10k MAU |
| Database | Neon PostgreSQL | Serverless, free tier, Drizzle compatible |
| Cache/Queue | Upstash Redis | Serverless, free tier, BullMQ compatible |
| Storage | Vercel Blob ili S3 | Temp audio storage, auto cleanup |
| Payments | Stripe | Industry standard, Clerk integration |
| Audio Recognition | ACRCloud Identify API | Već integrisano |

## Arhitektura

```
┌──────────────────────────────────────────────────────────────┐
│                     KORISNIK (Browser)                        │
│  React App (Vercel)                                          │
│  ├── Clerk <SignIn/> — auth                                  │
│  ├── FileUpload → Blob Storage                               │
│  ├── ProgressBar (SSE)                                       │
│  ├── Timeline + Manual Edit                                  │
│  └── Export/Share                                            │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                  API SERVER (Railway/Fly.io)                   │
│  Express + Clerk Middleware                                   │
│  ├── POST /api/upload → Blob → Queue                         │
│  ├── GET  /api/analysis/:id → DB + Segments                  │
│  ├── PATCH /api/analysis/:id/segments/:id → Manual Edit      │
│  ├── GET  /api/analysis/:id/export/:format                   │
│  ├── GET  /api/t/:slug → Public tracklist                    │
│  └── GET  /api/user/me → Credits, plan                       │
├──────────────────────────────────────────────────────────────┤
│  WORKERS (same server, separate processes)                    │
│  ├── Analysis Worker → ffmpeg + ACRCloud                     │
│  └── Retry Worker → per-segment retry                        │
└──────────────────────────────────────────────────────────────┘
               │
       ┌───────┼───────┐
       ▼       ▼       ▼
   ┌──────┐ ┌──────┐ ┌──────────┐
   │ Neon │ │Upstash│ │ ACRCloud │
   │ (DB) │ │(Redis)│ │  (API)   │
   └──────┘ └──────┘ └──────────┘
```

## Database Schema

### Nove tabele

```sql
-- Clerk upravlja user-ima, mi čuvamo extra data
CREATE TABLE users (
  clerk_id VARCHAR(255) PRIMARY KEY,
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  credits_remaining INTEGER NOT NULL DEFAULT 3,
  credits_reset_at TIMESTAMP NOT NULL,
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Manual edits za segmente
CREATE TABLE tracklist_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  original_track VARCHAR(500),
  corrected_track VARCHAR(500) NOT NULL,
  corrected_artist VARCHAR(255),
  corrected_title VARCHAR(255),
  corrected_by VARCHAR(255) NOT NULL REFERENCES users(clerk_id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Izmene u postojećim tabelama

```sql
-- analyses: dodaj owner, mode, share
ALTER TABLE analyses ADD COLUMN user_id VARCHAR(255) REFERENCES users(clerk_id);
ALTER TABLE analyses ADD COLUMN mode VARCHAR(10) DEFAULT 'fast';
ALTER TABLE analyses ADD COLUMN is_public BOOLEAN DEFAULT false;
ALTER TABLE analyses ADD COLUMN slug VARCHAR(50) UNIQUE;
```

## API Endpoints

### Auth (Clerk webhooks)
```
POST /api/auth/webhook          — Clerk webhook (user.created, user.deleted)
```

### User
```
GET  /api/user/me               — Profil, plan, credits
GET  /api/user/analyses         — Lista mojih mixeva (paginated)
```

### Analysis (postojeći + izmene)
```
POST /api/upload                — Upload mix (+ mode u form data) [auth required]
GET  /api/analysis/:id          — Rezultati sa segmentima [auth: owner only]
GET  /api/analysis/:id/progress — SSE progress [auth: owner only]
PATCH /api/analysis/:id         — Edit metadata (is_public, slug) [auth: owner]
```

### Segments
```
PATCH /api/analysis/:id/segments/:segId        — Manual track edit [auth: owner]
POST  /api/analysis/:id/segments/:segId/retry  — Retry segment [auth: owner]
POST  /api/analysis/:id/retry-unknown          — Retry all unknown [auth: owner]
```

### Export & Share
```
GET /api/analysis/:id/export/text       — Plain text tracklist
GET /api/analysis/:id/export/mixcloud   — Mixcloud format
GET /api/analysis/:id/export/soundcloud — SoundCloud format
GET /api/t/:slug                        — Public tracklist page (no auth)
```

## Export Formats

### Plain Text
```
1. 00:00 - 03:15  Daft Punk - Around the World
2. 03:15 - 07:30  Chemical Brothers - Block Rockin Beats
3. 07:30 - 12:00  Underworld - Born Slippy
```

### Mixcloud Format
```
Artist1 - Title1 @ 00:00
Artist2 - Title2 @ 03:15
Artist3 - Title3 @ 07:30
```

### SoundCloud Description
```
Tracklist:
00:00 Daft Punk - Around the World
03:15 Chemical Brothers - Block Rockin Beats
07:30 Underworld - Born Slippy
```

## Shareable Page

URL: `mixmatch.app/t/{slug}`

Javna stranica (bez auth) koja prikazuje:
- Mix naziv i DJ ime
- Timeline sa svim pesmama
- Linkovi ka Spotify/Beatport za svaku pesmu
- "Powered by MixMatch" (free plan) ili čist (Pro/Studio)
- Meta tags za social sharing (OG image sa tracklist-om)

## Implementation Phases

### Phase 1: Auth + User System (1-2 dana)
- Clerk integration (SignIn, SignUp, UserButton)
- Users tabela + Clerk webhook
- Protect existing API routes
- Credits system (dekrementuj pri uploadu)

### Phase 2: Manual Edit (1 dan)
- PATCH endpoint za segment edit
- Frontend inline editing na Timeline
- tracklist_edits tabela

### Phase 3: Export (1 dan)
- Export endpoints (text, mixcloud, soundcloud)
- Download/Copy button na Timeline

### Phase 4: Shareable Page (1 dan)
- is_public + slug na analyses
- Public GET /api/t/:slug endpoint
- Public tracklist React page (nova ruta)
- OG meta tags

### Phase 5: Streaming Links (1 dan)
- Parse ACRCloud external_metadata (Spotify, Beatport, Apple Music)
- Prikaži linkove uz svaku pesmu na Timeline

### Phase 6: Stripe + Pricing (1-2 dana)
- Stripe Checkout za Pro/Studio
- Webhook za subscription events
- Plan enforcement (credits, mode access)

### Phase 7: Deploy (1 dan)
- Vercel za frontend
- Railway za backend + workers
- Neon za DB
- Upstash za Redis
- Domain + SSL
