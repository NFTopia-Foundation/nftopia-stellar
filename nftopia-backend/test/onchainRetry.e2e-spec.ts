import { Worker, Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

jest.unmock('ioredis');
jest.setTimeout(30000);

describe('Onchain Queue Retry Logic', () => {
  let connection: Redis;
  let queue: Queue;
  let events: QueueEvents;
  let failureCount = 0;

  beforeAll(async () => {
    connection = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    });

    queue = new Queue('onchain-queue-test', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 100,
        },
      },
    });

    events = new QueueEvents('onchain-queue-test', { connection });
    await events.waitUntilReady();
  });

  afterAll(async () => {
    if (queue) await queue.close();
    if (events) await events.close();
    if (connection) await connection.quit();
  });

  it('should retry the job with exponential backoff on failure', async () => {
    const worker = new Worker(
      'onchain-queue-test',
      async () => {
        failureCount++;
        if (failureCount < 3) {
          throw new Error('Simulated failure');
        }
        return 'Success';
      },
      { connection }
    );

    // ✅ Add a job to the queue to trigger retries
    await queue.add('test-job', { some: 'data' });

    const result = await new Promise((resolve, reject) => {
      events.on('completed', () => resolve('completed'));
      events.on('failed', () => reject('Job failed unexpectedly'));
    });

    expect(result).toBe('completed');
    expect(failureCount).toBe(3);

    await worker.close();
  });
});
