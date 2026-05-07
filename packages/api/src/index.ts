import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';

import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';

import { uploadRouter } from './routes/upload.js';
import { analysisRouter } from './routes/analysis.js';
import { exportRouter } from './routes/export.js';
import { retryRouter } from './routes/retry.js';
import { userRouter } from './routes/user.js';
import { spotifyRouter } from './routes/spotify.js';
import { communityRouter } from './routes/community.js';

const AUTHORIZED_PARTIES = [
  'https://dist-omega-lemon-8esrrbeklw.vercel.app',
  'http://localhost:5173',
];

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(clerkMiddleware({
  secretKey: config.clerkSecretKey,
  publishableKey: config.clerkPublishableKey,
  authorizedParties: AUTHORIZED_PARTIES,
}));

const routes = [
  uploadRouter,
  analysisRouter,
  exportRouter,
  retryRouter,
  userRouter,
  spotifyRouter,
  communityRouter,
];

routes.forEach(router => app.use('/api', router));

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
