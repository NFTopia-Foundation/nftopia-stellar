import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceSettlementClient } from '../modules/stellar/marketplace-settlement.client';
import { SystemSettings } from './system-settings.entity';

/** SystemSettings key used to persist the contract-event cursor. */
export const LAST_CONTRACT_EVENT_LEDGER_KEY =
  'last_contract_event_indexed_ledger';

@Injectable()
export class ContractEventIndexerJob {
  private readonly logger = new Logger(ContractEventIndexerJob.name);

  constructor(
    private readonly settlementClient: MarketplaceSettlementClient,
    @InjectRepository(SystemSettings)
    private readonly settingsRepo: Repository<SystemSettings>,
  ) {}

  // Runs every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async handleIndexing(): Promise<void> {
    this.logger.log('Starting contract event indexing job...');

    const fromLedger = await this.loadCursor();

    let events: Record<string, unknown>[];
    let latestLedger: number;

    try {
      const result = await this.settlementClient.getEventsSince(fromLedger);
      events = result.events;
      latestLedger = result.latestLedger;
    } catch (err) {
      this.logger.error(
        `Failed to fetch events from ledger ${fromLedger}. Cursor NOT advanced.`,
        err instanceof Error ? err.stack : err,
      );
      return;
    }

    // TODO(#249): Replace this stub with real event persistence logic.
    try {
      await this.persistEvents(events);
    } catch (err) {
      this.logger.error(
        `Failed to persist ${events.length} event(s). Cursor NOT advanced.`,
        err instanceof Error ? err.stack : err,
      );
      return;
    }

    // Monotonic guard: only advance the cursor if the new ledger is
    // strictly greater than the currently stored value.
    await this.advanceCursor(latestLedger);

    this.logger.log(
      `Contract event indexing completed. ` +
        `fromLedger=${fromLedger} toLedger=${latestLedger} eventsCount=${events.length}`,
    );
  }

  // Cursor helpers

  /**
   * Read the persisted cursor from the database.
   * Returns 0 when no cursor has been stored yet (first run).
   */
  async loadCursor(): Promise<number> {
    const setting = await this.settingsRepo.findOne({
      where: { key: LAST_CONTRACT_EVENT_LEDGER_KEY },
    });
    return setting ? parseInt(setting.value, 10) : 0;
  }

  /**
   * Persist a new cursor value if and only if it is strictly greater than the
   * currently stored value. This monotonic guard prevents an out-of-order or
   * replayed value from rolling the cursor backwards.
   */
  async advanceCursor(newLedger: number): Promise<void> {
    const current = await this.loadCursor();
    if (newLedger <= current) {
      this.logger.debug(
        `Cursor not advanced: newLedger=${newLedger} <= current=${current}`,
      );
      return;
    }
    await this.settingsRepo.save({
      key: LAST_CONTRACT_EVENT_LEDGER_KEY,
      value: String(newLedger),
    });
    this.logger.debug(`Cursor advanced: ${current} -> ${newLedger}`);
  }

  // Event persistence stub

  /**
   * Persist fetched contract events to the database.
   *
   * TODO(#249): Replace this stub with real persistence logic (e.g. insert
   * into a contract_events table, update NFT state, emit domain events, etc.)
   */
  private persistEvents(events: Record<string, unknown>[]): Promise<void> {
    if (events.length === 0) {
      return Promise.resolve();
    }
    this.logger.debug(
      `persistEvents stub: ${events.length} event(s) would be persisted here.`,
    );
    return Promise.resolve();
  }
}
