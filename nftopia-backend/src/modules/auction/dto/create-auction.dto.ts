import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';

export class CreateAuctionDto {
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
}
