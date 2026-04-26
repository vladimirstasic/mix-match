# MixMatch

Automatic track identification for DJ mixes. Upload a mix, get a tracklist with timestamps.

## Features

- **Audio Recognition** — ACRCloud-powered track identification
- **Fast & Detailed modes** — scan every 2 min or every 30s
- **Per-segment retry** — retry individual unidentified sections
- **Smart aggregation** — groups same-track variants (remixes, remasters) using acrid + fuzzy matching
- **Confidence filtering** — rejects low-score false positives
- **Streaming progress** — real-time updates via SSE

## Tech Stack

- **Frontend:** React + Vite + Tailwind + shadcn/ui
- **Backend:** Express + BullMQ workers
- **Database:** PostgreSQL (Drizzle ORM)
- **Cache/Queue:** Redis
- **Recognition:** ACRCloud Identify API

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL + Redis
docker compose up -d

# 3. Copy env and add your ACRCloud keys
cp .env.example .env

# 4. Run database migrations
npm run db:migrate -w packages/api

# 5. Build shared package
npm run build -w packages/shared

# 6. Start dev servers (API + Web)
npm run dev

# 7. Start analysis worker (separate terminal)
npm run worker -w packages/api

# 8. (Optional) Start retry worker
npm run worker:retry -w packages/api
```

**Web:** http://localhost:5173
**API:** http://localhost:3001

## Project Structure

```
packages/
├── shared/     # Types and constants shared between API and Web
├── api/        # Express server, BullMQ workers, ACRCloud integration
└── web/        # React frontend
```

## Environment Variables

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mix_match
REDIS_URL=redis://localhost:6379
ACRCLOUD_HOST=identify-eu-west-1.acrcloud.com
ACRCLOUD_ACCESS_KEY=your_key
ACRCLOUD_ACCESS_SECRET=your_secret
```

## License

MIT
