// Types and DTOs for Marketplace Settlement Contract

export interface CreateSaleParams {
  seller: string;
  nftContract: string;
  tokenId: string;
  price: string; // i128 as string
  currency: string;
  durationSeconds: number;
}

export interface ExecutionResult {
  success: boolean;
  txHash: string;
  error?: string;
}

export interface SaleTransaction {
  id: number;
  seller: string;
  nftContract: string;
  tokenId: string;
  price: string;
  currency: string;
  buyer?: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface CreateAuctionParams {
  seller: string;
  nftContract: string;
  tokenId: string;
  startPrice: string;
  reservePrice: string;
  currency: string;
  auctionType: 'english' | 'dutch';
  durationSeconds: number;
}

export interface AuctionTransaction {
  id: number;
  seller: string;
  nftContract: string;
  tokenId: string;
  startPrice: string;
  reservePrice: string;
  currency: string;
  auctionType: string;
  status: string;
  highestBid?: string;
  winner?: string;
  createdAt: string;
  endsAt: string;
}

export interface CreateTradeParams {
  initiator: string;
  offeredNftContract: string;
  offeredTokenId: string;
  requestedNftContract: string;
  requestedTokenId: string;
  expiresAt: string;
}
