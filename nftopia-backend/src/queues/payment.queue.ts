import { Queue } from 'bullmq';
import { redisClient } from '../config/redis.config';

export const paymentQueue = new Queue('payment-queue', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  }
});
