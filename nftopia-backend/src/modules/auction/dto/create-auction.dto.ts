import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
  Max,
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

  @IsISO8601()
  @IsOptional()
  startTime?: string;

  @IsISO8601()
  @IsNotEmpty()
  endTime: string;

  /**
   * Override of the platform-wide minimum bid increment (#652), as a
   * fraction of the current highest bid (e.g. 0.1 = 10%). Omit to use the
   * platform default.
   */
  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  @Max(1)
  minBidIncrementPct?: number;
}
