import { BidSorobanStatus } from '../../../modules/auction/entities/bid.entity';

export interface BidPlacedEvent {
  auctionId: string;
  bidderId: string;
  stellarPublicKey: string;
  amount: number;
  amountXlm: string;
  txHash?: string;
  ledgerSequence?: number;
  sorobanStatus: BidSorobanStatus;
  timestamp: Date;
}

export interface HighestBidResult {
  auctionId: string;
  amount: number;
  amountXlm: string;
  bidderId: string;
  stellarPublicKey?: string;
  txHash?: string;
  ledgerSequence?: number;
  fromCache: boolean;
}

export interface BidListResult {
  data: BidRecord[];
  nextCursor?: number;
  total: number;
}

export interface BidRecord {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  amountXlm: string;
  txHash?: string;
  ledgerSequence?: number;
  stellarPublicKey?: string;
  sorobanStatus: BidSorobanStatus;
  createdAt: Date;
}

export const BID_PLACED_EVENT = 'bid.placed';
export const BID_CACHE_PREFIX = 'bid:highest:';
export const BID_CACHE_TTL_S = 30;
export const BID_RATE_LIMIT_PREFIX = 'bid:rl:';
export const BID_RATE_LIMIT_MAX = 5;
export const BID_RATE_LIMIT_WINDOW_S = 60;
/** Minimum increment: 5% of current highest bid */
export const BID_MIN_INCREMENT_PCT = 0.05;
/** Stroops per XLM */
export const STROOPS_PER_XLM = 10_000_000;
