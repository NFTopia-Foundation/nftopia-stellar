// Types for marketplace settlement contract integration

export type AuctionType = 'english' | 'dutch';

export interface CreateAuctionParams {
  seller: string;
  nftContract: string;
  tokenId: string;
  startPrice: string;
  reservePrice: string;
  currency: string;
  auctionType: AuctionType;
  durationSeconds: number;
}

export interface CreateSaleParams {
  seller: string;
  nftContract: string;
  tokenId: string;
  price: string;
  currency: string;
  durationSeconds: number;
}

export interface CreateTradeParams {
  initiator: string;
  offeredNftContract: string;
  offeredTokenId: string;
  requestedNftContract: string;
  requestedTokenId: string;
  expiresAt: string;
}
