import { Queue } from 'bullmq';
import { redis } from './index.js';

export const filescanPollQueue = new Queue('filescan-poll', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
