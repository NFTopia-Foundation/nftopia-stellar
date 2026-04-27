import { Injectable, Logger } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import {
  BID_UPDATE_EVENT,
  NOTIFICATION_EVENT,
  auctionRoom,
  userRoom,
  type BidUpdatePayload,
  type NotificationPayload,
} from './interfaces/notification.interface';

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

  constructor(private readonly gateway: NotificationsGateway) {}

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

    this.logger.debug(
      `[notify] user=${userId} type=${type} title="${title}"`,
    );
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

  // ── private helpers ────────────────────────────────────────────────────────

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for environments without Web Crypto API
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
