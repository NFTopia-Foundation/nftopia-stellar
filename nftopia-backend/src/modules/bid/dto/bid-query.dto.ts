import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BidQueryDto {
  /**
   * Cursor for ledger-sequence-based pagination.
   * Pass the `ledgerSequence` of the last bid returned to get the next page.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cursor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  /** Filter bids by bidder's Stellar public key */
  @IsOptional()
  @IsString()
  publicKey?: string;
}
