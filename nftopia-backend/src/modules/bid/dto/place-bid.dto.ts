import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';

export class PlaceBidDto {
  /**
   * Bid amount in XLM (e.g. "100.50").
   * The service converts this to stroops internally for on-chain submission.
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,7})?$/, {
    message: 'amount must be a valid XLM decimal (up to 7 decimal places)',
  })
  amount: string;

  /** Bidder's Stellar public key (G...). Used for wallet verification. */
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'publicKey must be a valid Stellar Ed25519 public key',
  })
  publicKey: string;

  /**
   * Base64-encoded Ed25519 signature over the canonical message:
   *   `bid:{auctionId}:{amount}`
   */
  @IsString()
  @IsNotEmpty()
  signature: string;

  /** Optional: memo/note attached to the bid */
  @IsString()
  @IsOptional()
  memo?: string;
}
