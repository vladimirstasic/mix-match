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

const app = express();

app.use(cors({ origin: true, credentials: true }));

app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);

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

import { eq, and, lt, inArray } from 'drizzle-orm';
import { analyses, segments as segmentsTable } from './db/schema.js';

async function cleanupStaleAnalyses() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const stale = await db
    .select({ id: analyses.id })
    .from(analyses)
    .where(and(inArray(analyses.status, ['pending', 'processing']), lt(analyses.updatedAt!, thirtyMinAgo)));

  for (const { id } of stale) {
    await db.delete(segmentsTable).where(eq(segmentsTable.analysisId, id));
    await db.delete(analyses).where(eq(analyses.id, id));
  }

  if (stale.length > 0) {
    console.log(`Cleaned up ${stale.length} stale analyses`);
  }
}

async function start() {
  const migrationsPath = path.join(process.cwd(), 'packages/api/dist/db/migrations');
  console.log('Running migrations from:', migrationsPath);
  await migrate(db, { migrationsFolder: migrationsPath });
  console.log('Migrations done.');

  await cleanupStaleAnalyses();

  setInterval(cleanupStaleAnalyses, 5 * 60 * 1000);

  app.listen(config.port, () => {
    console.log(`API server running on port ${config.port}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
