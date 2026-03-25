import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateAuctionDto {
  @IsString()
  @IsNotEmpty()
  nftContractId: string;

  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @IsString()
  @IsNotEmpty()
  seller: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,7})?$/, {
    message: 'startPrice must be a numeric string with up to 7 decimals',
  })
  startPrice: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,7})?$/, {
    message: 'reservePrice must be a numeric string with up to 7 decimals',
  })
  reservePrice: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,7})?$/, {
    message: 'minBidIncrement must be a numeric string with up to 7 decimals',
  })
  minBidIncrement?: string;
}
