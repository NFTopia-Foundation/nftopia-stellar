import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis.config';
import Redis from 'ioredis';
import { redisClient } from '../config/redis.config';


export const notificationsQueue = new Queue('notifications-queue', {
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