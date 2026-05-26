import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketplaceSettlementClient } from '../modules/stellar/marketplace-settlement.client';
import { ContractEventDlqService } from './contract-event-dlq.service';

@Injectable()
export class ContractEventIndexerJob {
  private readonly logger = new Logger(ContractEventIndexerJob.name);
  private lastIndexedLedger = 0;

  constructor(
    private readonly settlementClient: MarketplaceSettlementClient,
    private readonly dlqService: ContractEventDlqService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleIndexing() {
    this.logger.log('Starting contract event indexing job...');
    try {
      // TODO: Fetch events from the contract since lastIndexedLedger
      // const events = await this.settlementClient.getEventsSince(this.lastIndexedLedger);
      // for (const event of events) { await this.processEvent(event); }
      await Promise.resolve(true);
      this.logger.log('Contract event indexing completed.');
    } catch (err) {
      this.logger.error('Error indexing contract events', err);
      await this.dlqService.enqueue(
        { eventType: 'indexer_job', payload: { lastIndexedLedger: this.lastIndexedLedger } },
        err,
      );
    }
  }

  /** Process a single event; enqueue to DLQ on failure. */
  async processEvent(event: {
    contractId?: string;
    ledger?: number;
    txHash?: string;
    eventIndex?: number;
    eventType?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // TODO: persist event to DB
      await Promise.resolve(true);
    } catch (err) {
      await this.dlqService.enqueue(event, err);
    }
  }
}
