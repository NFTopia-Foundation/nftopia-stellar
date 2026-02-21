import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';

/**
 * Body for POST /bids/:auctionId.
 * Signature must be Ed25519 (base64) over buildBidMessage(auctionId, amount, timestamp).
 */
export class PlaceBidDto {
  @IsNotEmpty()
  @IsString()
  amount: string;

  @IsNotEmpty()
  @IsString()
  signature: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'publicKey must be a valid Stellar G... address' })
  publicKey: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  /** Signed Soroban transaction XDR (place_bid). When provided, backend verifies and submits. */
  @IsOptional()
  @IsString()
  signedTransactionXdr?: string;
}
