import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
  Min,
} from 'class-validator';

export class CreateAuctionDto {
  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  auctionType?: string;

  @IsString()
  @IsNotEmpty()
  nftContractId: string;

  @IsString()
  @IsNotEmpty()
  nftTokenId: string;

  @IsNumber()
  startPrice: number;

  @IsNumber()
  @IsOptional()
  reservePrice?: number;

  /**
   * Minimum increment a new bid must exceed the current highest bid by
   * for this auction. Overrides the platform-wide default when provided.
   */
  @IsNumber()
  @Min(0)
  @IsOptional()
  minBidIncrement?: number;

  /**
   * Optional percentage-increment override (e.g. 5 means 5%). When set, it
   * takes precedence over the fixed minBidIncrement for this auction.
   */
  @IsNumber()
  @Min(0)
  @IsOptional()
  minBidIncrementPercent?: number;

  @IsISO8601()
  @IsOptional()
  startTime?: string;

  @IsISO8601()
  @IsNotEmpty()
  endTime: string;
}
