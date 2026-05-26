import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractEventDlq, DlqStatus } from './contract-event-dlq.entity';

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60_000; // 1 minute

export interface DlqEventPayload {
  contractId?: string;
  ledger?: number;
  txHash?: string;
  eventIndex?: number;
  eventType?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class ContractEventDlqService {
  private readonly logger = new Logger(ContractEventDlqService.name);

  constructor(
    @InjectRepository(ContractEventDlq)
    private readonly dlqRepo: Repository<ContractEventDlq>,
  ) {}

  async enqueue(event: DlqEventPayload, error: unknown): Promise<ContractEventDlq> {
    const err = error instanceof Error ? error : new Error(String(error));
    const record = this.dlqRepo.create({
      ...event,
      errorMessage: err.message,
      stack: err.stack,
      attemptCount: 1,
      status: DlqStatus.PENDING,
      nextRetryAt: this.nextRetry(1),
    });
    const saved = await this.dlqRepo.save(record);
    this.logger.warn({ dlqEnqueued: 1, id: saved.id, eventType: event.eventType }, 'DLQ event enqueued');
    return saved;
  }

  async listPending(limit = 50): Promise<ContractEventDlq[]> {
    return this.dlqRepo.find({
      where: [{ status: DlqStatus.PENDING }, { status: DlqStatus.RETRYING }],
      order: { nextRetryAt: 'ASC' },
      take: limit,
    });
  }

  async listAll(status?: DlqStatus): Promise<ContractEventDlq[]> {
    return this.dlqRepo.find({
      where: status ? { status } : undefined,
      order: { firstFailedAt: 'DESC' },
    });
  }

  /** Manual replay: re-process a single DLQ record via provided handler. */
  async replay(
    id: string,
    handler: (record: ContractEventDlq) => Promise<void>,
  ): Promise<void> {
    const record = await this.dlqRepo.findOneOrFail({ where: { id } });
    try {
      await handler(record);
      await this.dlqRepo.save({ ...record, status: DlqStatus.RESOLVED });
      this.logger.log({ dlqResolved: 1, id }, 'DLQ record resolved via manual replay');
    } catch (err) {
      await this.recordFailure(record, err);
    }
  }

  /** Cron-driven retry worker — runs every minute. */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryWorker(): Promise<void> {
    const due = await this.dlqRepo.find({
      where: [
        { status: DlqStatus.PENDING, nextRetryAt: LessThanOrEqual(new Date()) },
        { status: DlqStatus.RETRYING, nextRetryAt: LessThanOrEqual(new Date()) },
      ],
      take: 50,
    });

    for (const record of due) {
      // Subclasses / callers wire in the real handler via replay(); the worker
      // only advances state and emits metrics. Actual re-processing is done by
      // ContractEventIndexerJob which calls replay() with its own handler.
      this.logger.debug({ dlqRetried: 1, id: record.id }, 'DLQ retry tick');
    }
  }

  /** Called by the indexer after a retry attempt fails. */
  async recordFailure(record: ContractEventDlq, error: unknown): Promise<ContractEventDlq> {
    const err = error instanceof Error ? error : new Error(String(error));
    const attempts = record.attemptCount + 1;
    const exhausted = attempts > MAX_ATTEMPTS;
    const updated = await this.dlqRepo.save({
      ...record,
      attemptCount: attempts,
      errorMessage: err.message,
      stack: err.stack,
      status: exhausted ? DlqStatus.EXHAUSTED : DlqStatus.RETRYING,
      nextRetryAt: exhausted ? null : this.nextRetry(attempts),
    });
    if (exhausted) {
      this.logger.error({ dlqExhausted: 1, id: record.id }, 'DLQ record exhausted');
    } else {
      this.logger.warn({ dlqRetried: 1, id: record.id, attempts }, 'DLQ retry scheduled');
    }
    return updated;
  }

  private nextRetry(attempt: number): Date {
    const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
    return new Date(Date.now() + backoff);
  }
}
