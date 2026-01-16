import { Worker, Queue } from 'bullmq';
import { redisClient, redisOptions } from '../config/redis.config';

// Worker for processing notifications
export const notificationsWorker = new Worker(
  'notifications-queue',
  async job => {
    try {
      const timeout = 15000; // timeput period

      // Creates a promise that rejects after the timeout period
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job ${job.id} timed out after ${timeout}ms`));
        }, timeout);
      });

      // Use Promise.race to enforce the timeout
      await Promise.race([
        (async () => {
          // TODO: Replace this with actual notification logic
          console.log(`Processing notification job ${job.id} with data:`, job.data);
        })(),
        timeoutPromise,
      ]);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error.message);
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

notificationsWorker.on('completed', job => {
  console.log(`Notification job ${job.id} completed successfully.`);
});

notificationsWorker.on('failed', async (job, err) => {
  console.error(`Notification job ${job?.id} failed:`, err);
  if (job && job.attemptsMade >= job.opts.attempts!) {
    const dlqQueue = new Queue('notifications-dlq', { connection: redisOptions });
    await dlqQueue.add('failed-notification-job', job.data);
    console.warn(`Moved job ${job.id} to DLQ.`);
  }
});
