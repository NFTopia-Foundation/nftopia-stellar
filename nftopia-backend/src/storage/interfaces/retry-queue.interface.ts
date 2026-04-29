import type { RetryQueueEntry } from '../storage.types';

export interface RetryQueue {
  enqueue(entry: RetryQueueEntry): Promise<void>;
  getEntries?(): RetryQueueEntry[];
}
