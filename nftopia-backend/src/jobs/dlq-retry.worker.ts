import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { ContractEventDlq } from './entities/contract-event-dlq.entity';
import { ContractEvent } from './entities/contract-event.entity';
import { IndexerService } from './indexer.service';
import { Horizon } from 'stellar-sdk';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class DlqRetryWorker {
  private readonly logger = new Logger(DlqRetryWorker.name);
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    @InjectRepository(ContractEventDlq)
    private readonly dlqRepo: Repository<ContractEventDlq>,
    @InjectRepository(ContractEvent)
    private readonly eventRepo: Repository<ContractEvent>,
    private readonly indexerService: IndexerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleRetries(): Promise<void> {
    this.logger.debug('Starting DLQ retry worker...');

    const dueEvents = await this.dlqRepo.find({
      where: {
        status: In(['pending', 'retrying']),
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      take: 100, // Process in batches
    });

    if (dueEvents.length === 0) {
      return;
    }

    this.logger.log(`Found ${dueEvents.length} DLQ events due for retry.`);

    let retriedCount = 0;
    let exhaustedCount = 0;
    let resolvedCount = 0;

    for (const dlq of dueEvents) {
      retriedCount++;
      try {
        dlq.attemptCount += 1;
        dlq.status = 'retrying';
        this.logger.log(
          `dlqRetried: Attempting to replay event txHash=${dlq.txHash} index=${dlq.eventIndex}`,
        );

        let inserted = false;

        // Check if this is an IndexerService domain event or a ContractEventIndexerJob raw event
        if (['mint', 'sale', 'transfer'].includes(dlq.eventType ?? '')) {
          // It's a domain event handled by IndexerService
          const txRecord =
            dlq.payload as unknown as Horizon.ServerApi.TransactionRecord;
          await this.indexerService.processTransaction(
            txRecord,
            dlq.contractId,
          );
          inserted = true;
        } else {
          // It's a raw event handled by ContractEventIndexerJob
          const entity = this.eventRepo.create({
            contractId: dlq.contractId,
            ledger: dlq.ledger,
            txHash: dlq.txHash,
            eventIndex: dlq.eventIndex,
            eventType: dlq.eventType,
            payload: dlq.payload,
          });

          // Use queryBuilder to do an insert or ignore to prevent duplicates if successful replay occurs
          const result = await this.eventRepo
            .createQueryBuilder()
            .insert()
            .into(ContractEvent)
            .values(entity as QueryDeepPartialEntity<ContractEvent>)
            .orIgnore()
            .execute();

          inserted = result.identifiers && result.identifiers.length > 0;
        }

        dlq.status = 'resolved';
        resolvedCount++;
        this.logger.log(
          `dlqResolved: successfully replayed event txHash=${dlq.txHash} index=${dlq.eventIndex}${!inserted ? ' (was already present)' : ''}`,
        );
      } catch (err) {
        // retriedCount already incremented
        dlq.lastFailedAt = new Date();
        dlq.errorMessage = err instanceof Error ? err.message : String(err);
        dlq.stack = err instanceof Error ? (err.stack ?? '') : '';

        if (dlq.attemptCount >= this.MAX_ATTEMPTS) {
          dlq.status = 'exhausted';
          exhaustedCount++;
          this.logger.warn(
            `dlqExhausted: Max attempts reached for txHash=${dlq.txHash} index=${dlq.eventIndex}`,
          );
        } else {
          // Exponential backoff: base * 2^attempts (e.g., 1m, 2m, 4m, 8m)
          const backoffMinutes = Math.pow(2, dlq.attemptCount - 1);
          dlq.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
        }
      } finally {
        await this.dlqRepo.save(dlq);
      }
    }

    this.logger.log(
      `DLQ Retry Summary - Retried: ${retriedCount}, Exhausted: ${exhaustedCount}, Resolved: ${resolvedCount}`,
    );
  }
}
