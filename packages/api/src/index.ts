import express from 'express';
import cors from 'cors';
import path from 'path';
import { clerkMiddleware } from '@clerk/express';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { config } from './config.js';
import { db } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';

import { uploadRouter } from './routes/upload.js';
import { analysisRouter } from './routes/analysis.js';
import { exportRouter } from './routes/export.js';
import { retryRouter } from './routes/retry.js';
import { userRouter } from './routes/user.js';
import { spotifyRouter } from './routes/spotify.js';
import { communityRouter } from './routes/community.js';
import { billingRouter, billingWebhookHandler } from './routes/billing.js';
import { acrcloudFilescanWebhookHandler } from './routes/webhooks.js';

const app = express();

// Express 4 does not forward rejections from async route handlers, and several routes
// deliberately re-throw (upload.ts, user.ts), so without this Node kills the process —
// taking all three workers and every in-flight scan down with it. Logged, not exited,
// on purpose: a failed request is not a reason to abort other users' scans.
process.on('unhandledRejection', err => {
  console.error('[unhandledRejection]', err);
});

app.use(cors({ origin: true, credentials: true }));

app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);
app.post('/api/webhooks/acrcloud-filescan', express.raw({ type: 'application/json' }), acrcloudFilescanWebhookHandler);

app.use(express.json());
app.use(clerkMiddleware());

app.use('/api', uploadRouter);
app.use('/api', analysisRouter);
app.use('/api', exportRouter);
app.use('/api', retryRouter);
app.use('/api', userRouter);
app.use('/api', spotifyRouter);
app.use('/api', communityRouter);
app.use('/api', billingRouter);

app.use(errorHandler);

import './workers/analysis.worker.js';
import './workers/retry.worker.js';
import './workers/filescan-poll.worker.js';

import { and, lt, inArray } from 'drizzle-orm';
import { analyses } from './db/schema.js';

// Worker concurrency is 1 and per-chunk progress is reported to BullMQ, not the DB, so
// `analyses.updatedAt` goes stale on scans that are alive but queued behind another job.
// 30 minutes was short enough to catch those.
const STALE_AFTER_MS = 90 * 60 * 1000;

// Marks abandoned scans failed rather than deleting them. The delete took the row, its
// segments and the spent credit with it and left the client polling an id that 404s
// forever; a failed row tells the user what happened, and if the worker was in fact
// still alive it overwrites the status when it finishes.
async function failStaleAnalyses() {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const stale = await db
    .update(analyses)
    .set({
      status: 'failed',
      error: 'Scan timed out — it was queued or running for too long. Please try again.',
      updatedAt: new Date(),
    })
    .where(and(inArray(analyses.status, ['pending', 'processing']), lt(analyses.updatedAt!, cutoff)))
    .returning({ id: analyses.id });

  if (stale.length > 0) {
    console.log(`Marked ${stale.length} stale analyses as failed`);
  }
}

async function start() {
  const migrationsPath = path.join(process.cwd(), 'packages/api/dist/db/migrations');
  console.log('Running migrations from:', migrationsPath);
  await migrate(db, { migrationsFolder: migrationsPath });
  console.log('Migrations done.');

  await failStaleAnalyses();

  setInterval(failStaleAnalyses, 5 * 60 * 1000);

  app.listen(config.port, () => {
    console.log(`API server running on port ${config.port}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
