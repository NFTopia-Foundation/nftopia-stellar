import { IsOptional, IsString, IsIn, IsNumber } from 'class-validator';
import { ListingStatus } from '../interfaces/listing.interface';

export class ListingQueryDto {
  @IsOptional()
  @IsIn(Object.values(ListingStatus))
  status?: ListingStatus;

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
