import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const analysisQueue = new Queue("analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const queueEvents = new QueueEvents("analysis", { connection: redis.duplicate() });
