# Per-Segment Retry & Overlap Chunks — Design

> Date: 2026-04-14
> Status: Draft

## Problem

1. **Redis keš blokira retry** — kad korisnik nije zadovoljan rezultatima, ne može ponovo analizirati isti fajl jer je keširan
2. **Loše prepoznavanje radio mixeva** — ACRCloud pogađa samo ~20% pesama jer 15s fiksni chunkovi padaju na džinglove, govor, ili tranzicije
3. **Nema granularnog retry-a** — korisnik mora ponovo uploadovati ceo fajl čak i ako je samo jedna pesma pogrešna

## Solution Overview

### A. Per-Segment Retry

Umesto jednog JSONB blob-a za rezultate, svaki deo mix-a je zaseban `segment` u bazi. Korisnik može retry-ovati pojedinačne segmente bez ponovnog uploada celog fajla.

### B. Overlap Chunkovi

Umesto fiksnih 15s chunkova bez preklapanja, koristimo 15s chunkove sa 5s overlap-om. Svaka pozicija u mixu se pokriva iz bar dva chunk-a.

---

## Data Model Changes

### Nova tabela: `segments`

```sql
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  start_sec INTEGER NOT NULL,
  end_sec INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unknown',  -- 'identified' | 'unknown' | 'retrying'
  track_name VARCHAR(500),
  artist VARCHAR(255),
  title VARCHAR(255),
  acrid VARCHAR(100),
  confidence REAL,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Izmene u `analyses` tabeli

- `results` JSONB ostaje za backward compat ali se populiše iz segments tabele
- Dodajemo `chunks_dir` VARCHAR — putanja do chunk fajlova (za retry)
- Dodajemo `chunks_expire_at` TIMESTAMP — kad istekne, chunkovi se brišu

### Temp File Management

- Chunk WAV fajlovi se čuvaju u `{uploadDir}/{analysisId}/chunks/`
- Ne brišu se odmah nakon analize
- Cleanup: chunkovi stariji od 24h se brišu (cron job ili provera pri uploadu)
- Dok postoje chunkovi, retry je moguć
- Kad chunkovi isteknu, retry dugme se disable-uje na frontu

---

## API Changes

### GET /api/analysis/:id (modified)

Response uključuje segmente:

```json
{
  "id": "abc-123",
  "filename": "radio-mix.mp3",
  "status": "completed",
  "segments": [
    {
      "id": "seg-1",
      "startSec": 0,
      "endSec": 195,
      "status": "identified",
      "trackName": "Daft Punk - Around the World",
      "artist": "Daft Punk",
      "title": "Around the World",
      "confidence": 0.92,
      "attempts": 1
    },
    {
      "id": "seg-2",
      "startSec": 195,
      "endSec": 330,
      "status": "unknown",
      "trackName": null,
      "confidence": null,
      "attempts": 1
    }
  ],
  "chunksAvailable": true,
  "chunksExpireAt": "2026-04-15T18:00:00Z",
  "metrics": { ... }
}
```

### POST /api/analysis/:id/segments/:segmentId/retry (new)

Retry jednog segmenta.

- Enqueue-uje mini-job za samo te chunkove
- Koristi drugačiji offset/duration baziran na attempt broju
- Returns: `{ jobId: "..." }`

**Retry strategija po attempt broju:**

| Attempt | Chunk Duration | Offset | Rationale |
|---------|---------------|--------|-----------|
| 1 | 15s | 0s | Standard (originalni prolaz) |
| 2 | 15s | +7s | Pomeren prozor — hvata drugačiji deo |
| 3 | 10s | 0s | Kraći uzorak, manje šuma |
| 4 | 10s | +5s | Kraći + pomeren |

### POST /api/analysis/:id/retry-unknown (new)

Retry svih segmenata sa `status: "unknown"`.

- Enqueue-uje jedan job koji obrađuje sve unknown segmente
- Koristi iste retry strategije kao gore

---

## Overlap Chunk Strategy

### Splitting

Trenutno:
```
ffmpeg -f segment -segment_time 15 ...
```

Novo — generišemo chunkove sa eksplicitnim start pozicijama:
```
Position 0:  ffmpeg -ss 0  -t 15 ...  → chunk_0000.wav
Position 1:  ffmpeg -ss 10 -t 15 ...  → chunk_0001.wav  (5s overlap)
Position 2:  ffmpeg -ss 20 -t 15 ...  → chunk_0002.wav
...
```

- Svaki chunk je 15s
- Novi sadržaj: 10s, overlap: 5s
- Za 5min mix: 30 chunkova (umesto 20)

### Aggregator Changes

Aggregator mora da razume da se chunkovi preklapaju:
- Dva uzastopna chunk-a sa istim track-om → merge, ali end_sec se računa od drugog chunk-a
- Overlap zone: kad dva chunk-a daju različite rezultate, koristi onaj sa višim confidence score-om

### Impact on Optimizer

- Coast mode: i dalje radi, samo sa gušćim chunkovima
- Fingerprint dedup: overlap chunkovi iste pesme će se verovatno deduplikovati → minimalan API overhead
- Očekivana realna povećanja API poziva: ~10-20% (ne 50%) zahvaljujući dedup-u

---

## Frontend Changes

### Timeline Component

Prikazuje i identified i unknown segmente:

```
00:00 - 03:15  ✓ Daft Punk - Around the World         [confidence: 92%]
03:15 - 05:30  ✗ Unknown track                          [Retry ↻]
05:30 - 08:45  ✓ Chemical Brothers - Block Rockin Beats [confidence: 87%]
```

- Identified segmenti: zelena oznaka, ime pesme
- Unknown segmenti: siva/crvena, "Retry" dugme
- "Retry All Unknown" dugme na vrhu
- Kad chunkovi isteknu (24h), retry dugmad se disable-uju sa tooltip-om "Re-upload file to retry"

### Progress za retry

- Kad korisnik klikne retry, segment prelazi u "retrying" status
- Spinner/progress na tom segmentu
- SSE stream šalje update kad retry završi
- Segment se update-uje in-place bez reload-a stranice

---

## Cleanup Strategy

### Chunk File Cleanup

- Pri svakom novom uploadu, proveravamo da li postoje stari chunk direktorijumi (>24h) i brišemo ih
- Alternativno: background cron svakih sat vremena
- `analyses.chunks_expire_at` se setuje na `NOW() + 24h` pri kreiranju

### Redis Cache

- File hash keš: ostaje ali se ignoriše kad korisnik eksplicitno retry-uje
- Fingerprint keš: ostaje, ali retry za specifičan segment ne koristi fingerprint keš (forsira API poziv)

---

## Implementation Order

1. **DB migration** — dodaj `segments` tabelu, nove kolone u `analyses`
2. **Overlap chunks** — izmeni `splitIntoChunks` za overlap, update aggregator
3. **Segment storage** — worker čuva rezultate u segments tabelu, ne briše chunkove odmah
4. **API endpoints** — retry segment, retry-all-unknown
5. **Frontend** — prikaži segmente sa retry dugmadima, SSE za retry progress
6. **Cleanup** — cron/check za brisanje starih chunkova
