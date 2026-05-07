import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(clerkMiddleware());

app.use('/api', uploadRouter);
app.use('/api', analysisRouter);
app.use('/api', exportRouter);
app.use('/api', retryRouter);
app.use('/api', userRouter);
app.use('/api', spotifyRouter);
app.use('/api', communityRouter);

app.use(errorHandler);

async function start() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: path.join(__dirname, 'db/migrations') });
  console.log('Migrations done.');

  app.listen(config.port, () => {
    console.log(`API server running on port ${config.port}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
