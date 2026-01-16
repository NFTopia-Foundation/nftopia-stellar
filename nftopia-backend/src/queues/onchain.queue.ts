import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis.config';
import { redisClient } from '../config/redis.config';
import Redis from 'ioredis';

export const onchainQueue = new Queue('onchain-queue', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});