/**
 * Shape of a payload pushed to an end-user over the `notification`
 * WebSocket event. Kept deliberately small — this is the "UI toast"
 * channel, not a full notification record.
 */
export interface NotificationPayload {
  /**
   * Stable identifier for the notification. If the client deduplicates
   * (e.g. on reconnect) this is what to key on.
   */
  id: string;
  /**
   * Free-form category — UI uses it to pick an icon/colour.
   * Examples: "bid.received", "item.sold", "auction.won".
   */
  type: string;
  /**
   * Short human-readable title ("New Bid").
   */
  title: string;
  /**
   * Optional longer body ("User X bid 150 XLM on Auction Y").
   */
  message?: string;
  /**
   * Arbitrary structured context for the client to act on (e.g. auctionId).
   * Keep it JSON-serialisable.
   */
  data?: Record<string, unknown>;
  /**
   * ISO-8601 timestamp. Set by NotificationsService if omitted.
   */
  timestamp?: string;
}

/**
 * Shape of a `bid_update` broadcast to everyone subscribed to an
 * auction room. Strictly a price/meta update — no user-targeted content.
 */
export interface BidUpdatePayload {
  auctionId: string;
  amount: number;
  amountXlm: string;
  bidderId: string;
  txHash?: string;
  ledgerSequence?: number;
  timestamp: string;
}

/**
 * The subset of the JWT payload we keep on the authenticated Socket.
 * Matches what JwtStrategy.validate() returns in src/auth/jwt.strategy.ts.
 */
export interface AuthenticatedSocketUser {
  userId: string;
  username?: string;
  email?: string;
}

export const NOTIFICATION_EVENT = 'notification';
export const BID_UPDATE_EVENT = 'bid_update';

/** Room name for a user's private notification channel. */
export const userRoom = (userId: string): string => `user:${userId}`;

/** Room name for a public auction channel (bid_update broadcasts). */
export const auctionRoom = (auctionId: string): string =>
  `auction:${auctionId}`;
