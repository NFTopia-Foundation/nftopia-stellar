import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { Bid } from '../../auction/entities/bid.entity';
import {
  BID_PLACED_EVENT,
  BID_CACHE_PREFIX,
  BID_CACHE_TTL_S,
  STROOPS_PER_XLM,
  type BidPlacedEvent,
  type HighestBidResult,
} from '../interfaces/bid.interface';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * BidEventListener
 *
 * Listens for `bid.placed` events emitted by BidService and:
 *  1. Refreshes the Redis highest-bid cache with the new bid amount.
 *  2. Pushes a real-time `notification` WebSocket event to the seller.
 *  3. Broadcasts a `bid_update` WebSocket event to all auction subscribers.
 *  4. Logs the on-chain confirmation details for audit / tracing.
 */
@Injectable()
export class BidEventListener {
  private readonly logger = new Logger(BidEventListener.name);

  constructor(
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(BID_PLACED_EVENT, { async: true })
  async handleBidPlaced(event: BidPlacedEvent): Promise<void> {
    try {
      await this.refreshHighestBidCache(event);
      this.notifySeller(event);
      this.broadcastBidUpdate(event);
      this.logBidAuditEntry(event);
    } catch (err) {
      this.logger.error(
        `BidEventListener failed for auction ${event.auctionId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private async refreshHighestBidCache(event: BidPlacedEvent): Promise<void> {
    const cacheKey = `${BID_CACHE_PREFIX}${event.auctionId}`;

    const existing = await this.cacheManager.get<HighestBidResult>(cacheKey);

    const newAmount = event.amount;

    if (existing && existing.amount >= newAmount) {
      // Existing cache is already higher or equal — no update needed
      return;
    }

    const updated: HighestBidResult = {
      auctionId: event.auctionId,
      amount: newAmount,
      amountXlm: event.amountXlm,
      bidderId: event.bidderId,
      stellarPublicKey: event.stellarPublicKey,
      txHash: event.txHash,
      ledgerSequence: event.ledgerSequence,
      fromCache: true,
    };

    await this.cacheManager.set(cacheKey, updated, BID_CACHE_TTL_S);

    this.logger.debug(
      `Cache refreshed for auction ${event.auctionId}: ` +
        `highest bid = ${event.amountXlm} XLM (bidder=${event.bidderId})`,
    );
  }

  /** Push a toast-style notification to the seller. */
  private notifySeller(event: BidPlacedEvent): void {
    this.notificationsService.notifyUser(
      event.sellerId,
      'bid.received',
      'New Bid',
      `A bid of ${event.amountXlm} XLM was placed on your auction`,
      {
        auctionId: event.auctionId,
        bidderId: event.bidderId,
        amountXlm: event.amountXlm,
      },
    );
  }

  /** Broadcast real-time price update to all auction subscribers. */
  private broadcastBidUpdate(event: BidPlacedEvent): void {
    this.notificationsService.broadcastBidUpdate(event.auctionId, {
      auctionId: event.auctionId,
      amount: event.amount,
      amountXlm: event.amountXlm,
      bidderId: event.bidderId,
      txHash: event.txHash,
      ledgerSequence: event.ledgerSequence,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private logBidAuditEntry(event: BidPlacedEvent): void {
    const amountStroops = Math.round(event.amount * STROOPS_PER_XLM);

    this.logger.log(
      `[AUDIT] BidPlaced | auction=${event.auctionId} ` +
        `seller=${event.sellerId} ` +
        `bidder=${event.bidderId} ` +
        `key=${event.stellarPublicKey} ` +
        `amount=${event.amountXlm} XLM (${amountStroops} stroops) ` +
        `txHash=${event.txHash ?? 'n/a'} ` +
        `ledger=${event.ledgerSequence ?? 'n/a'} ` +
        `sorobanStatus=${event.sorobanStatus} ` +
        `ts=${event.timestamp.toISOString()}`,
    );
  }
}
