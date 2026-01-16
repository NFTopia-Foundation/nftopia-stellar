import { Worker, Queue } from 'bullmq';
import { redisClient, redisOptions } from '../config/redis.config';
import * as Sentry from '@sentry/node';

export const paymentWorker = new Worker(
  'payment-queue',
  async job => {
    try {
      const timeout = 15000; //timeout period 15s

      // Create a promise that rejects after the timeout period
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job ${job.id} timed out after ${timeout}ms`));
        }, timeout);
      });

      // Use Promise.race to enforce the timeout
      await Promise.race([
        (async () => {
          // TODO: Replace this with actual payment logic
          console.log(`Processing payment job ${job.id}:`, job.data);
          return { success: true };
        })(),
        timeoutPromise,
      ]);
    } catch (error) {
      console.error(`Payment job failed: ${job.id}`, error);
      Sentry.captureException(error);
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

paymentWorker.on('completed', job => {
  console.log(`Payment job completed: ${job.id}`);
});

paymentWorker.on('failed', async (job, err) => {
  console.error(`Payment job failed: ${job?.id}`, err);
  Sentry.captureException(err);
  if (job && job.attemptsMade >= job.opts.attempts!) {
    const dlqQueue = new Queue('payment-dlq', { connection: redisOptions });
    await dlqQueue.add('failed-payment-job', job.data);
    console.warn(`Moved payment job ${job.id} to DLQ`);
  }
});
