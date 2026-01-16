import { Worker, Queue } from 'bullmq';
import { redisOptions } from '../config/redis.config';
import { redisClient } from '../config/redis.config';
import * as Sentry from '@sentry/node';

export const onchainWorker = new Worker(
  'onchain-queue',
  async job => {
    try {
      const timeout = 15000; // timeout period 15s

      // Create a promise that rejects after the timeout period
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job ${job.id} timed out after ${timeout}ms`));
        }, timeout);
      });

      // Use Promise.race to enforce the timeout
      await Promise.race([
        (async () => {
          // TODO: Replace this with actual onchain logic
          console.log(`Processing onchain job ${job.id} with data:`, job.data);
        })(),
        timeoutPromise,
      ]);
    } catch (error) {
      console.error(`Job failed: ${job.id}`, error);
      throw error;
    }
  },
  {
    connection: redisClient,
    limiter: {
      max: 1000,
      duration: 60000,
    },
  }
);

onchainWorker.on('completed', job => {
  console.log(`Completed job ${job.id}`);
});

onchainWorker.on('failed', async (job, err) => {
  console.error(`Failed job ${job.id}:`, err);
  if (job && job.attemptsMade >= job.opts.attempts!) {
    const dlqQueue = new Queue('onchain-dlq', { connection: redisOptions });
    await dlqQueue.add('failed-job', job.data);
  }
  Sentry.captureException(err);
});
