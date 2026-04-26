# Mix Detective — Backend Tutorijal

> Ovaj tutorijal objašnjava kako radi backend (API) deo Mix Detective aplikacije.
> Pisan je za developere koji razumeju frontend, ali žele da nauče backend koncepte.

---

## Sadržaj

1. [Šta radi ovaj backend?](#1-šta-radi-ovaj-backend)
2. [Tech stack — šta i zašto](#2-tech-stack--šta-i-zašto)
3. [Struktura fajlova](#3-struktura-fajlova)
4. [Konfiguracija i environment varijable](#4-konfiguracija-i-environment-varijable)
5. [Baza podataka (PostgreSQL + Drizzle ORM)](#5-baza-podataka-postgresql--drizzle-orm)
6. [Redis i job queue (BullMQ)](#6-redis-i-job-queue-bullmq)
7. [Rute (Express endpoints)](#7-rute-express-endpoints)
8. [Servisi — poslovna logika](#8-servisi--poslovna-logika)
9. [Workeri — pozadinski procesi](#9-workeri--pozadinski-procesi)
10. [Ceo tok podataka od uploada do rezultata](#10-ceo-tok-podataka-od-uploada-do-rezultata)
11. [Per-Segment Retry — kako radi](#11-per-segment-retry--kako-radi)
12. [Shared paket — zajednički ugovor](#12-shared-paket--zajednički-ugovor)
13. [Testovi](#13-testovi)

---

## 1. Šta radi ovaj backend?

Korisnik uploaduje audio fajl (DJ mix, radio emisija, podcast). Backend:

1. Prima fajl
2. Seče ga na komade od 15 sekundi **sa 5s preklapanjem** (overlap)
3. Svaki komad šalje na ACRCloud (servis za prepoznavanje muzike)
4. Spaja rezultate u timeline: "00:00–03:45 Daft Punk — Around the World"
5. Prikazuje i **neprepoznate** delove — korisnik može kliknuti "Retry" za svaki
6. Šalje rezultat nazad frontendu

Zvuči prosto, ali postoji gomila optimizacija da se ne troše nepotrebni API pozivi (koji koštaju novac), i sistem za retry koji omogućava poboljšanje rezultata bez ponovnog uploada.

---

## 2. Tech stack — šta i zašto

### Express.js — HTTP server

```
Klijent  →  HTTP request  →  Express  →  odgovor
```

Express je minimalan Node.js framework za pravljenje API-ja. Registruješ rute (URL putanje) i handler funkcije:

```typescript
// "Kad neko pošalje POST na /api/upload, pokreni ovu funkciju"
app.post("/api/upload", async (req, res) => {
  // obradi request
  res.json({ result: "ok" });
});
```

**Zašto Express?** Najjednostavniji i najpopularniji. Za ovaj projekat ne treba ništa složenije.

---

### PostgreSQL — relaciona baza podataka

**Šta je baza?** Trajno skladište podataka. Kad se server restartuje, podaci ostaju.

**Zašto PostgreSQL a ne, recimo, SQLite ili MongoDB?**
- SQLite: ok za male projekte, ali ne podržava dobro konkurentne konekcije (kad worker i API server pristupaju istovremeno)
- MongoDB: NoSQL, fleksibilniji ali nepotreban ovde — imamo jasnu strukturu podataka
- PostgreSQL: robustan, podržava JSONB (čuvamo metrike kao JSON u SQL bazi), odličan za produkciju

Imamo **dve tabele**:

```
┌──────────────────────────────────────────────────────┐
│                    analyses                           │
├──────────────────┬───────────────────────────────────┤
│ id               │ UUID — jedinstven identifikator    │
│ filename         │ "my_mix.mp3"                       │
│ file_size        │ 52428800 (bajti)                   │
│ file_hash        │ SHA256 hash celog fajla            │
│ status           │ "pending" → "processing" →         │
│                  │ "completed" ili "failed"            │
│ total_chunks     │ 48 (koliko komada od 15s)          │
│ processed_chunks │ 32 (koliko je obrađeno)            │
│ results          │ JSON: [{track, start, end}]        │
│ metrics          │ JSON: {apiCalls, cacheHits...}     │
│ error            │ poruka greške ako je failed         │
│ chunks_dir       │ putanja do chunk fajlova (za retry)│
│ chunks_expire_at │ kad istekne, chunkovi se brišu     │
│ created_at       │ timestamp                          │
│ updated_at       │ timestamp                          │
└──────────────────┴───────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                    segments                           │
├──────────────────┬───────────────────────────────────┤
│ id               │ UUID                               │
│ analysis_id      │ FK → analyses (CASCADE DELETE)     │
│ start_sec        │ početak segmenta u sekundama       │
│ end_sec          │ kraj segmenta u sekundama          │
│ status           │ "identified" | "unknown" | "retrying"│
│ track_name       │ "Daft Punk - Around the World"     │
│ artist           │ "Daft Punk"                        │
│ title            │ "Around the World"                 │
│ acrid            │ ACRCloud ID pesme                  │
│ confidence       │ pouzdanost prepoznavanja (0-1)     │
│ attempts         │ koliko puta je pokušano            │
│ created_at       │ timestamp                          │
│ updated_at       │ timestamp                          │
└──────────────────┴───────────────────────────────────┘
```

**Zašto dve tabele?** `analyses` prati ceo upload. `segments` prati svaki deo mixa posebno — i prepoznate pesme i neprepoznate delove. Ovo omogućava retry pojedinačnih segmenata bez ponovne analize celog fajla.

---

### Redis — in-memory keš

**Šta je Redis?** Baza podataka koja živi u memoriji (RAM). Ekstremno brza (~1ms po operaciji), ali podaci nestaju kad se ugasi (po defaultu).

**Zašto Redis? Tri razloga:**

#### Razlog 1: Keš za fingerprinte

Kad prepoznamo audio komad, sačuvamo rezultat:
```
ključ: "acr:fp:a3f2b1..."     →     vrednost: {"artist":"Daft Punk", "title":"Around the World"}
TTL: 30 dana
```

Ako isti audio komad dođe ponovo (drugi korisnik uploada isti mix), ne trebamo ponovo zvati ACRCloud API — samo pročitamo iz Redisa.

#### Razlog 2: Keš za cele fajlove

```
ključ: "acr:file:sha256hash..."  →  vrednost: "analysis-uuid-123"
TTL: 90 dana
```

Ako neko uploada identičan fajl, odmah vraćamo prethodni rezultat.

#### Razlog 3: Job queue (BullMQ)

BullMQ koristi Redis kao svoju "bazu". Više o tome u sekciji 6.

**Analogija:** PostgreSQL je sef (siguran, trajan, sporiji). Redis je džep (brz pristup, ali ograničen kapacitet).

---

### BullMQ — job queue

**Problem:** Obrada audio fajla traje 1–5 minuta. Ne možeš držati HTTP konekciju otvorenom toliko dugo.

**Rešenje:** Kad korisnik uploada fajl:
1. API odmah odgovori: "OK, tvoj ID je abc-123"
2. Stavi zadatak u red (queue): "obradi fajl abc-123"
3. Poseban proces (worker) uzima zadatak iz reda i obrađuje ga
4. Frontend polira ili sluša SSE stream za progres

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────────────┐
│  Klijent  │────▶│ API      │────▶│  Redis   │────▶│  Analysis      │
│ (browser) │◀────│ (Express)│     │  (queue) │     │  Worker        │
└──────────┘     └──────────┘     └──────────┘     └────────────────┘
   poll/SSE         odmah               job           obrađuje
   za progres       odgovori            čeka          u pozadini

                                  ┌──────────┐     ┌────────────────┐
                  retry request──▶│  Redis   │────▶│  Retry         │
                                  │  (queue) │     │  Worker        │
                                  └──────────┘     └────────────────┘
```

Imamo **dva queue-a**: `analysis` za početnu obradu i `retry` za ponovne pokušaje pojedinačnih segmenata.

**Zašto BullMQ a ne, recimo, samo `setTimeout`?**
- Ako se worker sruši, job ostaje u redu i može se retry-ovati
- Možeš imati više workera na više mašina
- Ima ugrađen progress reporting, events, prioritete
- Čuva istoriju jobova

---

### Drizzle ORM

**Šta je ORM?** Sloj između tvog koda i SQL-a. Umesto da pišeš sirovi SQL:

```sql
INSERT INTO analyses (filename, file_size, status) VALUES ('mix.mp3', 52428800, 'pending');
```

Pišeš TypeScript:

```typescript
await db.insert(analyses).values({
  filename: "mix.mp3",
  fileSize: 52428800,
  status: "pending",
});
```

**Zašto Drizzle?** Lagan, brz, i ima odličan type-safety. Schema se definiše u TypeScript-u, a Drizzle generiše SQL migracije automatski.

---

## 3. Struktura fajlova

```
packages/api/
├── drizzle.config.ts          # Konfiguracija za Drizzle migracije
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # Entry point — Express server
    ├── config.ts              # Čita .env varijable
    ├── db/
    │   ├── schema.ts          # Definicija tabela (TypeScript)
    │   ├── client.ts          # Konekcija ka bazi
    │   └── migrations/        # SQL migracije (auto-generisane)
    ├── queue/
    │   └── index.ts           # Redis konekcija + BullMQ queues
    ├── routes/
    │   ├── upload.ts          # POST /api/upload
    │   ├── analysis.ts        # GET /api/analysis/:id, SSE
    │   └── retry.ts           # POST retry endpoints
    ├── services/
    │   ├── acrcloud.ts        # ACRCloud API klijent
    │   ├── ffmpeg.ts          # Audio obrada (ffmpeg wrapper)
    │   ├── fingerprint.ts     # Audio fingerprinting
    │   ├── optimizer.ts       # 5-fazna optimizacija
    │   ├── aggregator.ts      # Spajanje rezultata u timeline
    │   └── segments.ts        # Pravljenje segmenata (identified + unknown)
    └── workers/
        ├── analysis.worker.ts # Pozadinski proces za obradu
        └── retry.worker.ts    # Pozadinski proces za retry
```

**Princip:** Svaki fajl ima jednu odgovornost. `routes/` zna za HTTP, `services/` zna za logiku, `workers/` zna za background processing. Oni ne znaju jedni za druge osim kroz jasne interface-e.

---

## 4. Konfiguracija i environment varijable

### Zašto .env?

Nikad ne hardkoduješ passworde, API ključeve, ili URL-ove u kod. Zašto?
- Različita okruženja (dev, staging, production) imaju različite vrednosti
- Ne commituješ tajne u git (`.env` je u `.gitignore`)
- Lako se menja bez izmene koda

### Kako radi

```
.env fajl (root projekta):
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mix_match
REDIS_URL=redis://localhost:6379
ACRCLOUD_HOST=identify-eu-west-1.acrcloud.com
ACRCLOUD_ACCESS_KEY=tvoj_ključ
ACRCLOUD_ACCESS_SECRET=tvoja_tajna
```

`dotenv` paket čita ovaj fajl i stavlja vrednosti u `process.env`:

```typescript
// config.ts
import "dotenv/config";  // ← ovo učitava .env

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

**`!` na kraju** — TypeScript non-null assertion. Kažeš kompajleru "verujem da ova vrednost postoji". U produkciji bi dodao validaciju (npr. sa `zod`).

**`||` fallback** — ako varijabla nije definisana, koristi default vrednost. PORT nije kritičan, ali DATABASE_URL jeste (zato nema fallback).

**Napomena:** Pošto se workeri pokreću iz `packages/api/` direktorijuma, a `.env` je u root-u, koristimo `DOTENV_CONFIG_PATH=../../.env` u npm skriptama da dotenv zna gde da traži fajl.

---

## 5. Baza podataka (PostgreSQL + Drizzle ORM)

### Schema — definicija tabela

```typescript
// db/schema.ts
import { pgTable, uuid, varchar, integer, jsonb, text, timestamp, real } from "drizzle-orm/pg-core";

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
  chunksDir: varchar("chunks_dir", { length: 500 }),       // putanja do chunk fajlova
  chunksExpireAt: timestamp("chunks_expire_at"),             // kad istekne, retry nije moguć
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysisId: uuid("analysis_id").notNull()
    .references(() => analyses.id, { onDelete: "cascade" }),  // ← briši segmente kad se obriše analiza
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

**`references()`** — foreign key. Svaki segment pripada jednoj analizi. `onDelete: "cascade"` znači: kad obrišeš analizu, automatski se obrišu i svi njeni segmenti.

**`real`** — PostgreSQL tip za decimalne brojeve. Koristimo za confidence score (0.0–1.0).

### Klijent — konekcija

```typescript
// db/client.ts
const url = new URL(config.databaseUrl);
const pool = new pg.Pool({
  host: url.hostname,
  port: parseInt(url.port || "5432"),
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
});
export const db = drizzle(pool, { schema });
```

**Connection pool** — umesto da otvara novu konekciju za svaki upit (sporo), pool drži nekoliko konekcija otvorenih i reciklira ih.

### Migracije

Migracija = SQL fajl koji menja strukturu baze. Kad dodaš kolonu ili tabelu u schema.ts:

```bash
npm run db:generate -w packages/api  # Drizzle generiše SQL migraciju
npm run db:migrate -w packages/api   # Primeni migraciju na bazu
```

**Zašto migracije?** Kad imaš tim, svako mora imati istu strukturu baze. Migracije su verzionisane promene koje se primenjuju redom. Prva migracija kreira `analyses`, druga dodaje `segments` tabelu i nove kolone.

### CRUD operacije

```typescript
// CREATE — insert novog reda
const [analysis] = await db
  .insert(analyses)
  .values({ filename: "mix.mp3", fileSize: 1000, status: "pending" })
  .returning({ id: analyses.id });  // ← vrati generisani ID

// READ — čitanje sa relacijom
const [row] = await db.select().from(analyses).where(eq(analyses.id, "some-uuid")).limit(1);
const segs = await db.select().from(segments).where(eq(segments.analysisId, "some-uuid")).orderBy(segments.startSec);

// UPDATE — izmena
await db
  .update(segments)
  .set({ status: "identified", trackName: "Daft Punk - Around the World" })
  .where(eq(segments.id, "segment-uuid"));

// Batch INSERT — više redova odjednom
await db.insert(segments).values([
  { analysisId: "...", startSec: 0, endSec: 120, status: "identified", ... },
  { analysisId: "...", startSec: 120, endSec: 180, status: "unknown", ... },
]);
```

---

## 6. Redis i job queue (BullMQ)

### Redis konekcija

```typescript
// queue/index.ts
import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export const redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,  // BullMQ zahteva ovo
});
```

`ioredis` je Redis klijent za Node.js. `maxRetriesPerRequest: null` je specifičan zahtev BullMQ-a — bez toga BullMQ blokira.

### Queue setup

```typescript
// Dva queue-a: jedan za analizu, jedan za retry
export const analysisQueue = new Queue("analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,                       // ne retry-uj automatski
    removeOnComplete: { count: 100 },  // čuvaj poslednjih 100 uspešnih
    removeOnFail: { count: 50 },       // čuvaj poslednjih 50 neuspešnih
  },
});

export const retryQueue = new Queue("retry", {
  connection: redis,
  defaultJobOptions: { attempts: 1, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
});
```

**Zašto dva queue-a?** Analysis jobovi su veliki (obradi ceo fajl). Retry jobovi su mali (obradi jedan segment). Razdvajanje omogućava da retry ne čeka iza velikog posla.

### QueueEvents — praćenje progresa

```typescript
export const queueEvents = new QueueEvents("analysis", {
  connection: redis.duplicate(),  // ← mora posebna konekcija!
});
```

QueueEvents sluša Redis pub/sub kanale za eventove (progress, completed, failed). Koristi ih SSE endpoint da streamuje progres klijentu.

**Zašto `redis.duplicate()`?** BullMQ interno koristi Redis `BLPOP` komandu koja blokira konekciju. QueueEvents mora imati svoju konekciju da ne bi blokirao ostale operacije.

---

## 7. Rute (Express endpoints)

### POST /api/upload — prijem fajla

```typescript
// routes/upload.ts
import multer from "multer";

const upload = multer({
  dest: config.uploadDir,                              // gde čuva fajl
  limits: { fileSize: MAX_FILE_SIZE },                 // 200MB limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);   // OK
    } else {
      cb(new Error(`Unsupported: ${file.mimetype}`));  // odbij
    }
  },
});
```

**Multer** je middleware za upload fajlova. Express sam po sebi ne zna da primi fajlove — multer parsira `multipart/form-data` format.

```typescript
uploadRouter.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;  // multer dodaje ovo na request

  // Čisti stare chunk fajlove (>24h) — fire and forget
  cleanupExpiredChunks().catch((err) => console.error("[cleanup]", err));

  // 1. Hash fajla za dedup
  const fileBuffer = await fs.readFile(file.path);
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // 2. Da li smo već analizirali ovaj fajl?
  const cachedAnalysisId = await redis.get(`acr:file:${fileHash}`);
  if (cachedAnalysisId) {
    await fs.unlink(file.path);  // obriši upload, nepotreban
    res.json({ analysisId: cachedAnalysisId });
    return;
  }

  // 3. Kreiraj zapis u bazi
  const [analysis] = await db.insert(analyses).values({...}).returning({ id: analyses.id });

  // 4. Stavi u red za obradu
  await analysisQueue.add("analyze", { analysisId: analysis.id, filePath: file.path, fileHash });

  // 5. Odmah vrati ID klijentu
  res.json({ analysisId: analysis.id });
});
```

**`cleanupExpiredChunks()`** — pri svakom uploadu, proverimo da li postoje stari chunk direktorijumi (>24h) i obrišemo ih. Ovo je "opportunistic cleanup" — ne treba poseban cron job.

### GET /api/analysis/:id — rezultati sa segmentima

Vraća analizu **sa svim segmentima** i info da li su chunk fajlovi još dostupni za retry:

```typescript
analysisRouter.get("/analysis/:id", async (req, res) => {
  const [analysis] = await db.select().from(analyses)
    .where(eq(analyses.id, req.params.id)).limit(1);

  // Dohvati segmente sortirane po vremenu
  const segs = await db.select().from(segments)
    .where(eq(segments.analysisId, req.params.id))
    .orderBy(segments.startSec);

  // Proveri da li chunk fajlovi još postoje na disku
  let chunksAvailable = false;
  if (analysis.chunksDir) {
    try { await fs.access(analysis.chunksDir); chunksAvailable = true; } catch {}
  }

  res.json({ ...analysis, segments: segs, chunksAvailable });
});
```

### GET /api/analysis/:id/progress — Server-Sent Events (SSE)

**SSE** je kao jednostavan WebSocket — server šalje podatke klijentu u realnom vremenu, ali samo u jednom smeru (server → klijent).

```typescript
// SSE setup
res.writeHead(200, {
  "Content-Type": "text/event-stream",   // browser zna da je SSE
  "Cache-Control": "no-cache",           // ne keširati
  Connection: "keep-alive",              // drži konekciju otvorenom
});

// Šaljemo podatke kad se nešto desi
const send = (data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// Slušamo BullMQ eventove
queueEvents.on("progress", ({ data }) => {
  if (data.analysisId === req.params.id) {
    send({ type: "progress", ...data });
  }
});
```

Na frontendu:
```typescript
const eventSource = new EventSource("/api/analysis/abc-123/progress");
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // { type: "progress", chunksProcessed: 5, totalChunks: 48, currentTrack: "...", tracksFound: 3 }
};
```

### POST /api/analysis/:id/segments/:segmentId/retry — retry jednog segmenta

```typescript
retryRouter.post("/analysis/:id/segments/:segmentId/retry", async (req, res) => {
  // 1. Proveri da li analiza postoji
  // 2. Proveri da li chunk fajlovi još postoje na disku
  // 3. Nađi segment u bazi
  // 4. Postavi status na "retrying"
  // 5. Enqueue retry job sa drugačijim parametrima
  await retryQueue.add("retry-segment", {
    analysisId: id, segmentId, startSec, endSec,
    chunksDir: analysis.chunksDir, attempt: segment.attempts + 1,
  });
  res.json({ jobId: job.id });
});
```

### POST /api/analysis/:id/retry-unknown — retry svih neprepoznatih

Isti princip, ali pronađe sve segmente sa `status: "unknown"` i enqueue-uje jedan batch job.

---

## 8. Servisi — poslovna logika

### ffmpeg.ts — audio obrada

**FFmpeg** je CLI alat za manipulaciju audio/video fajlova. Pozivamo ga iz Node.js:

```typescript
import { execFile } from "child_process";
const exec = promisify(execFile);

// Konvertuj bilo koji format u standardni WAV
async function normalizeAudio(inputPath, outputPath) {
  await exec("ffmpeg", [
    "-i", inputPath,     // ulazni fajl
    "-ac", "1",          // mono (1 kanal, dovoljno za identifikaciju)
    "-ar", "44100",      // sample rate 44.1kHz
    "-f", "wav",         // izlazni format
    "-y",                // overwrite ako postoji
    outputPath,
  ]);
}
```

#### Overlap chunkovi — ključna promena

Umesto fiksnih 15s komada bez preklapanja, koristimo **15s komade sa 5s overlap-om**:

```
BEZ OVERLAPA (staro):
|---15s---|---15s---|---15s---|
chunk 0    chunk 1    chunk 2

SA OVERLAPOM (novo):
|---15s---|
     |---15s---|
          |---15s---|
chunk 0  chunk 1  chunk 2
    ↑ 10s korak, 5s overlap
```

Svaka pozicija u mixu se pokriva iz bar dva chunk-a. Ako džingl ili govor padne na granicu jednog chunk-a, drugi ga "hvata" sa čistijim uzorkom.

```typescript
// Izračunaj pozicije za chunkove
export function computeChunkPositions(durationSec, chunkDuration, stepSec) {
  const positions = [];
  for (let pos = 0; pos < durationSec; pos += stepSec) {
    positions.push(pos);
  }
  return positions;
  // Za 60s fajl sa step=10: [0, 10, 20, 30, 40, 50]
}

// Svaki chunk se pravi sa ffmpeg -ss (seek) i -t (duration)
async function splitIntoChunks(wavPath, outputDir) {
  const duration = await getDuration(wavPath);
  const positions = computeChunkPositions(duration, CHUNK_DURATION_SEC, CHUNK_STEP_SEC);

  for (let i = 0; i < positions.length; i++) {
    await exec("ffmpeg", [
      "-i", wavPath,
      "-ss", String(positions[i]),    // počni od ove sekunde
      "-t", String(CHUNK_DURATION_SEC), // uzmi 15 sekundi
      "-c", "copy", "-y",
      path.join(outputDir, `chunk_${String(i).padStart(4, "0")}.wav`),
    ]);
  }

  return { paths: [...], positions: [...] };
}
```

**Zašto 15 sekundi?** ACRCloud optimalno prepoznaje pesme sa ~15s uzorka. Kraće = nepouzdano, duže = trošiš vreme.

**Zašto 5s overlap?** Dovoljno da uhvati tranzicije i džinglove koji padaju na granice, a dedup optimizacija sprečava duplirane API pozive za iste pesme.

### acrcloud.ts — prepoznavanje muzike

ACRCloud API zahteva HMAC-SHA1 potpis za autentifikaciju:

```typescript
function buildSignature(stringToSign, accessSecret) {
  return crypto.createHmac("sha1", accessSecret)
    .update(stringToSign)
    .digest("base64");
}
```

Šalje audio chunk kao multipart form data i parsira odgovor.

**Retry sa exponential backoff:**
```
Pokušaj 1: odmah
Pokušaj 2: čekaj 1s
Pokušaj 3: čekaj 2s
Pokušaj 4: čekaj 4s
```

**Rate limit handling:** Kad ACRCloud vrati "requests limit exceeded", bacamo `RateLimitError` odmah (bez retry-a). Optimizer hvata ovu grešku i čuva sve rezultate prikupljene do tog trenutka umesto da baci ceo posao.

### optimizer.ts — 5-fazna optimizacija (najbitniji fajl!)

Ovo je srce sistema. Za mix od 60 minuta imamo ~360 komada (sa overlapom). Bez optimizacije = 360 API poziva. Sa optimizacijom = možda 30-40.

```
Za svaki chunk:

Faza 1: SILENCE GATE
  ├─ Ako je glasnoća < -40dB → PRESKOČI (tišina, pauza u mixu)
  │
Faza 2: COAST MODE
  ├─ Ako smo prepoznali istu pesmu 3 puta zaredom
  │   → ne proveravaj svaki chunk, proveri svakih 4
  │   (ista pesma se verovatno nastavlja)
  │
Faza 3: FINGERPRINT DEDUP
  ├─ Generiši audio fingerprint
  ├─ Ako smo već videli sličan fingerprint u OVOJ analizi → koristi taj rezultat
  │
Faza 4: REDIS CACHE
  ├─ Proveri Redis za ovaj fingerprint (možda je drugi korisnik već identifikovao)
  │
Faza 5: API POZIV
  └─ Tek sad zovi ACRCloud (košta novac i vreme)
      └─ Sačuvaj rezultat u Redis za buduće korišćenje
      └─ Ako rate limit → sačuvaj sve do sada i prekini
```

**Zašto ovaj redosled?** Svaka faza je jeftinija od sledeće:
- Silence gate: ~0ms (samo proveri broj)
- Coast mode: ~0ms (samo if/else)
- Fingerprint dedup: ~50ms (lokalna obrada)
- Redis cache: ~1ms (mrežni poziv, ali brz)
- API poziv: ~500-2000ms (HTTP poziv ka eksternom servisu)

**Sa overlap chunkovima**, fingerprint dedup i coast mode postaju još efikasniji — overlap chunkovi iste pesme se automatski deduplikuju, tako da realno povećanje API poziva je samo ~10-20% (ne 50%).

### fingerprint.ts — audio fingerprinting

```
Audio chunk → 11025Hz mono PCM → 5 vremenskih prozora → 32 frekventnih bendova po prozoru
→ top 5 bendova po prozoru → MD5 hash = fingerprint
```

**Hamming distance** meri koliko se dva fingerprinta razlikuju po bitovima. Ako je sličnost >= 85%, smatramo da su isti audio.

### aggregator.ts — spajanje u timeline

```
Ulaz (raw matches sa overlap pozicijama):
  0:00  Daft Punk - Around the World
  0:10  Daft Punk - Around the World
  0:20  Daft Punk - Around the World
  0:30  Chemical Brothers - Block Rockin Beats
  0:40  Chemical Brothers - Block Rockin Beats

Izlaz (timeline):
  00:00 - 00:35  Daft Punk - Around the World
  00:30 - 00:55  Chemical Brothers - Block Rockin Beats
```

Grupiši uzastopne identične pesme, koristeći `startSec + CHUNK_DURATION_SEC` za kraj svakog segmenta.

### segments.ts — pravljenje segmenata

Posle aggregacije, `buildSegments` pravi listu segmenata uključujući **neprepoznate delove** (gaps):

```typescript
// Ulaz: timeline + ukupno trajanje
// Izlaz: lista segmenata sa identified I unknown delovima

buildSegments(timeline, rawMatches, totalDurationSec)
// →  [
//   { startSec: 0, endSec: 30, status: "unknown", trackName: null },
//   { startSec: 30, endSec: 120, status: "identified", trackName: "Daft Punk - ..." },
//   { startSec: 120, endSec: 180, status: "unknown", trackName: null },
//   { startSec: 180, endSec: 300, status: "identified", trackName: "Chemical Brothers - ..." },
//   { startSec: 300, endSec: 360, status: "unknown", trackName: null },
// ]
```

Ovo je ključno za retry — korisnik vidi i prepoznate i neprepoznate delove i može retry-ovati samo neprepoznate.

---

## 9. Workeri — pozadinski procesi

### Analysis Worker — glavna obrada

Pokreće se kao **odvojen proces**:

```bash
npm run worker -w packages/api   # poseban terminal!
```

To je bitno — worker nije deo Express servera. Može se restartovati nezavisno.

**Pipeline:**
```
1.  Postavi status → "processing"
2.  Normalizuj audio u WAV
3.  Izmeri trajanje, izračunaj pozicije sa overlapom
4.  Iseči na 15s komade (sa 5s overlap, korak 10s)
5.  Sačuvaj putanju do chunk direktorijuma u bazi (za retry)
6.  Izmeri glasnoću svakog komada (za silence detection)
7.  Pokreni 5-faznu optimizaciju
8.  Spoji rezultate u timeline
9.  Napravi segmente (identified + unknown gaps)
10. Sačuvaj segmente u bazu
11. Sačuvaj rezultate i metrike u bazu → status "completed"
12. Keširaj file hash u Redis
13. Obriši originalni upload i normalized.wav (ali ZADRŽI chunk fajlove za retry!)
```

**Ključna razlika od pre:** Chunk fajlovi se **ne brišu** nakon analize. Čuvaju se 24h za eventualni retry. Samo se originalni upload i normalized.wav brišu.

Ako bilo šta pukne → `catch` blok stavlja status na "failed" i briše sve temp fajlove.

### Retry Worker — ponovni pokušaji

```bash
npm run worker:retry -w packages/api   # treći terminal
```

Obrađuje dva tipa jobova:

**`retry-segment`** — retry jednog segmenta:
1. Nađi chunk fajl koji pokriva taj vremenski opseg
2. Pošalji na ACRCloud sa **drugačijim parametrima** nego prvi put
3. Ako nađe pesmu → update segment u bazi na "identified"
4. Ako ne nađe → probaj alternativni chunk, pa vrati "unknown"

**Retry strategija — svaki pokušaj koristi drugačiji pristup:**

| Pokušaj | Offset | Trajanje | Zašto |
|---------|--------|----------|-------|
| 1 | 0s | 15s | Standardni (originalna analiza) |
| 2 | +7s | 15s | Pomeren prozor — hvata drugačiji deo pesme |
| 3 | 0s | 10s | Kraći uzorak, manje šuma od džingla |
| 4 | +5s | 10s | Kraći + pomeren |

**`retry-all-unknown`** — retry svih neprepoznatih:
- Prolazi kroz sve `unknown` segmente jednog po jednog
- Ako udari u rate limit, staje i čuva sve do tada

---

## 10. Ceo tok podataka od uploada do rezultata

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KORISNIK                                      │
│   1. Izabere fajl  →  2. Upload  →  8. Vidi timeline  →  9. Retry?  │
└──────────┬──────────────────────────────────▲──────────────┬─────────┘
           │                                  │              │
           ▼                                  │              ▼
┌─────────────────┐                  ┌────────────────┐  ┌──────────────┐
│ POST /api/upload │                  │ GET /analysis  │  │ POST /retry  │
│                  │                  │ + segments     │  │              │
│ • Multer primi   │                  │ + chunksAvail  │  │ • Nađi chunk │
│ • SHA256 hash    │                  └───────▲────────┘  │ • Enqueue    │
│ • Cleanup starih │                          │           │   retry job  │
│ • INSERT u bazu  │                          │           └──────┬───────┘
│ • Dodaj u queue  │                          │                  │
└────────┬─────────┘                          │                  ▼
         │                                    │           ┌──────────────┐
         ▼                                    │           │ Retry Worker │
┌─────────────────┐    progress events        │           │              │
│  Analysis Queue  │──────────────────────────┘           │ • Drugačiji  │
│  (Redis)         │                                      │   parametri  │
└────────┬─────────┘                                      │ • Update DB  │
         │ worker uzima job                               └──────────────┘
         ▼
┌──────────────────────────────────────────────────────┐
│              ANALYSIS WORKER                          │
│                                                      │
│  normalize → overlap split → RMS → optimize →        │
│  aggregate → build segments → save to DB             │
│  (čuva chunk fajlove 24h za retry!)                  │
└──────────────────────────────────────────────────────┘
```

---

## 11. Per-Segment Retry — kako radi

Ovo je najvažnija nova funkcionalnost. Evo kompletnog flow-a:

### Problem koji rešava

ACRCloud ne prepoznaje svaku pesmu (džinglovi, govor, niska kvaliteta). Bez retry-a, korisnik mora ponovo uploadovati ceo fajl i čekati celu analizu. Sa retry-om:

1. **Analiza završi** → korisnik vidi timeline sa identified i unknown segmentima
2. **Korisnik klikne Retry** na unknown segmentu
3. **Backend ponovo pokuša** sa drugačijim parametrima (pomeren offset, kraći chunk)
4. **Segment se update-uje** u bazi — ili ga sad prepozna ili ostaje unknown
5. **Frontend se update-uje** in-place bez reload-a

### Čuvanje chunk fajlova

```typescript
// Worker NE briše chunkove nakon analize:
// ✅ Briše: originalni upload, normalized.wav
// ❌ NE briše: chunks/ direktorijum

// Čuva putanju i expiry u bazi:
const chunksExpireAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
await db.update(analyses).set({ chunksDir, chunksExpireAt, ... });
```

### Cleanup starih chunkova

Svaki put kad se uploada novi fajl, proveravamo stare chunkove:

```typescript
async function cleanupExpiredChunks() {
  const expired = await db.select().from(analyses)
    .where(lt(analyses.chunksExpireAt, new Date()));

  for (const row of expired) {
    await fs.rm(row.chunksDir, { recursive: true, force: true });
    await db.update(analyses).set({ chunksDir: null, chunksExpireAt: null });
  }
}
```

### Frontend retry flow

1. Korisnik klikne "Retry" → `POST /api/analysis/:id/segments/:segmentId/retry`
2. Segment prelazi u status "retrying" → spinner u UI-u
3. Frontend polira `GET /api/analysis/:id` svake 2s
4. Kad segment više nije "retrying" → update UI

---

## 12. Shared paket — zajednički ugovor

`packages/shared/` sadrži tipove i konstante koje koriste i API i Web:

```typescript
// types.ts — TypeScript interfejsi
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
}

export interface AnalysisWithSegments extends AnalysisResult {
  segments: Segment[];
  chunksAvailable: boolean;
  chunksExpireAt: string | null;
}

// constants.ts — magični brojevi na jednom mestu
export const CHUNK_DURATION_SEC = 15;
export const CHUNK_STEP_SEC = 10;         // korak između chunkova (15 - 5 overlap)
export const CHUNK_OVERLAP_SEC = 5;
export const CHUNKS_TTL_HOURS = 24;       // koliko dugo čuvamo chunk fajlove
export const MAX_FILE_SIZE = 200 * 1024 * 1024;  // 200MB
export const SILENCE_THRESHOLD_DB = -40;
export const REDIS_FINGERPRINT_TTL = 30 * 24 * 60 * 60;  // 30 dana
```

**Zašto shared paket?** Ako promeniš tip na backendu, frontend odmah dobije TypeScript grešku. Nema "zaboravio sam da ažuriram frontend" situacija.

---

## 13. Testovi

Testovi su u `__tests__/` folderima pored fajlova koje testiraju:

```bash
npx vitest run    # pokreni sve testove (12 testova)
```

Primeri testiranih funkcija:
- `computeChunkPositions` — overlap pozicije za različita trajanja
- `aggregateMatches` — spajanje preklapajućih chunkova u timeline
- `buildSignature` — ACRCloud HMAC-SHA1 potpis
- `hammingDistance` / `isSimilar` — fingerprint poređenje
- `formatTimestamp` — sekunde u "mm:ss"

Testirane su čiste funkcije (bez mrežnih poziva, bez baze) — brze i pouzdane.

---

## Pokretanje svega

```bash
# Terminal 1: Docker kontejneri (PostgreSQL + Redis)
docker compose up

# Terminal 2: Migracija baze (jednom, posle svakog schema update-a)
npm run db:migrate -w packages/api

# Terminal 3: API + Web (dev mode)
npm run dev

# Terminal 4: Analysis Worker
npm run worker -w packages/api

# Terminal 5: Retry Worker (za per-segment retry)
npm run worker:retry -w packages/api
```

Web: http://localhost:5173
API: http://localhost:3001
