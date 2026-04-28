export enum ListingStatus {
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export interface ListingSummary {
  id: string;
  nftContractId: string;
  nftTokenId: string;
  sellerId: string;
  price: string;
  currency?: string;
  status: ListingStatus;
  expiresAt?: Date;
}
