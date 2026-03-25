export enum AuctionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  SETTLED = 'SETTLED',
}

export interface AuctionSummary {
  id: string;
  nftContractId: string;
  nftTokenId: string;
  sellerId: string;
  startPrice: string;
  currentPrice: string;
  reservePrice?: string;
  startTime: Date;
  endTime: Date;
  status: AuctionStatus;
  winnerId?: string;
}
