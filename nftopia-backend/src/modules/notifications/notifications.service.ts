import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsGateway } from './notifications.gateway';
import {
  BID_UPDATE_EVENT,
  NOTIFICATION_EVENT,
  auctionRoom,
  userRoom,
  type BidUpdatePayload,
  type NotificationPayload,
} from './interfaces/notification.interface';
import { EmailQueueService } from '../email/queue/email.queue.service';
import { User } from '../../users/user.entity';

/**
 * NotificationsService
 *
 * Injectable service that wraps the authenticated WebSocket gateway.
 * Import NotificationsModule into any feature module that needs to push
 * real-time events (Marketplace, Auth, Bid, etc.).
 *
 * ### Key Methods
 * - `notifyUser(userId, type, title, message?, data?)` — sends a toast-style
 *   `notification` event to the private `user:{userId}` room.
 * - `broadcastBidUpdate(auctionId, payload)` — sends a `bid_update` event to
 *   the public `auction:{auctionId}` room for all subscribed clients.
 *
 * ### Design Notes
 * IDs are generated with `crypto.randomUUID()` (available in Node ≥ 19,
 * and already present in Node 18 behind the --experimental-global-webcrypto
 * flag which NestJS already enables through its bootstrap process).
 * If the runtime is older, the fallback timestamp-based ID is used.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly gateway: NotificationsGateway,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional() private readonly emailQueueService: EmailQueueService,
  ) {}

  /**
   * Send a `notification` event to a single authenticated user.
   *
   * @param userId  - The user's ID (must match the `sub` claim in their JWT)
   * @param type    - Category string, e.g. "bid.received", "item.sold", "auction.won"
   * @param title   - Short human-readable title shown in the UI toast
   * @param message - Optional longer description
   * @param data    - Optional structured context (auctionId, nftId, …)
   */
  notifyUser(
    userId: string,
    type: string,
    title: string,
    message?: string,
    data?: Record<string, unknown>,
  ): void {
    const payload: NotificationPayload = {
      id: this.generateId(),
      type,
      title,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    this.gateway
      .getServer()
      .to(userRoom(userId))
      .emit(NOTIFICATION_EVENT, payload);

    this.logger.debug(`[notify] user=${userId} type=${type} title="${title}"`);
  }

  /**
   * Broadcast a `bid_update` event to all clients subscribed to the given auction.
   *
   * Clients must first emit `join_auction { auctionId }` to receive these.
   */
  broadcastBidUpdate(auctionId: string, payload: BidUpdatePayload): void {
    this.gateway
      .getServer()
      .to(auctionRoom(auctionId))
      .emit(BID_UPDATE_EVENT, payload);

    this.logger.debug(
      `[bid_update] auction=${auctionId} amount=${payload.amountXlm} XLM bidder=${payload.bidderId}`,
    );
  }

  /**
   * Send bid notification email to NFT owner
   * @param ownerId Owner's user ID
   * @param nftName NFT name
   * @param bidderName Bidder's display name
   * @param bidAmount Bid amount in XLM
   * @param auctionId Auction ID
   * @param collectionName Optional collection name
   * @param auctionEndTime Optional auction end time
   */
  async sendBidNotificationEmail(
    ownerId: string,
    nftName: string,
    bidderName: string,
    bidAmount: string,
    auctionId: string,
    collectionName?: string,
    auctionEndTime?: string,
  ): Promise<void> {
    try {
      const owner = await this.userRepository.findOne({
        where: { id: ownerId },
      });

      if (!owner || !owner.email || !owner.isEmailVerified) {
        this.logger.debug(
          `Skipping bid notification email for user ${ownerId}: no verified email`,
        );
        return;
      }

      if (!this.emailQueueService) {
        this.logger.debug('EmailQueueService not available, skipping email');
        return;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const auctionUrl = `${frontendUrl}/auction/${auctionId}`;

      await this.emailQueueService.queueBidNotificationEmail(
        owner.email,
        owner.username || owner.email,
        nftName,
        bidderName,
        bidAmount,
        auctionUrl,
        collectionName,
        auctionEndTime,
      );

      this.logger.log(
        `Bid notification email queued for ${owner.email} (NFT: ${nftName})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue bid notification email: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send auction won email to winner
   * @param winnerId Winner's user ID
   * @param nftName NFT name
   * @param sellerName Seller's display name
   * @param winningAmount Winning bid amount in XLM
   * @param nftId NFT ID
   * @param collectionName Optional collection name
   */
  async sendAuctionWonEmail(
    winnerId: string,
    nftName: string,
    sellerName: string,
    winningAmount: string,
    nftId: string,
    collectionName?: string,
  ): Promise<void> {
    try {
      const winner = await this.userRepository.findOne({
        where: { id: winnerId },
      });

      if (!winner || !winner.email || !winner.isEmailVerified) {
        this.logger.debug(
          `Skipping auction won email for user ${winnerId}: no verified email`,
        );
        return;
      }

      if (!this.emailQueueService) {
        this.logger.debug('EmailQueueService not available, skipping email');
        return;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const nftUrl = `${frontendUrl}/nft/${nftId}`;

      await this.emailQueueService.queueAuctionWonEmail(
        winner.email,
        winner.username || winner.email,
        nftName,
        sellerName,
        winningAmount,
        nftUrl,
        collectionName,
      );

      this.logger.log(
        `Auction won email queued for ${winner.email} (NFT: ${nftName})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue auction won email: ${error.message}`,
        error.stack,
      );
    }
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for environments without Web Crypto API
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
