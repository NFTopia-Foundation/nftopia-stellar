import { Injectable, Logger } from '@nestjs/common';
import type { RetryQueue } from '../interfaces/retry-queue.interface';
import type { RetryQueueEntry } from '../storage.types';

@Injectable()
export class InMemoryRetryQueueService implements RetryQueue {
  private readonly logger = new Logger(InMemoryRetryQueueService.name);
  private readonly entries: RetryQueueEntry[] = [];

  async enqueue(entry: RetryQueueEntry): Promise<void> {
    this.entries.push({
      ...entry,
      queuedAt: new Date().toISOString(),
    });

    this.logger.warn(
      `Storage retry queued for ${entry.provider} (hash=${entry.fileHash}, attempt=${entry.attempt})`,
    );
  }

  getEntries(): RetryQueueEntry[] {
    return [...this.entries];
  }
}
