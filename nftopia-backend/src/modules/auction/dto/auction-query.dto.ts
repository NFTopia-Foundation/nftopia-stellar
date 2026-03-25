import { IsOptional, IsString, IsIn, IsNumber } from 'class-validator';
import { AuctionStatus } from '../interfaces/auction.interface';

export class AuctionQueryDto {
  @IsOptional()
  @IsIn(Object.values(AuctionStatus))
  status?: AuctionStatus;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsString()
  nftContractId?: string;

  @IsOptional()
  @IsString()
  nftTokenId?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
