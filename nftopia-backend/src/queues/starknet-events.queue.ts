import { Queue } from 'bullmq';
import { redisClient } from '../config/redis.config';

export interface StarkNetEventData {
  eventType: 'marketplace' | 'auction' | 'transaction';
  contractAddress: string;
  blockNumber: number;
  transactionHash: string;
  eventName: string;
  eventData: any;
  timestamp: number;
}

export const starknetEventsQueue = new Queue<StarkNetEventData>('starknet-events', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});