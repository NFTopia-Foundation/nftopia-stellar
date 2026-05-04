import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionOperationDto {
  @IsString()
  @MaxLength(64)
  type: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}

export class CreateTransactionDto {
  @IsUUID()
  sellerId: string;

  @IsOptional()
  @IsUUID()
  nftId?: string;

  @IsString()
  @MaxLength(56)
  nftContractId: string;

  @IsString()
  @MaxLength(128)
  nftTokenId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  currency?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionOperationDto)
  operations?: TransactionOperationDto[];

  @IsOptional()
  @IsString()
  listingId?: string;

  @IsOptional()
  @IsString()
  auctionId?: string;
}
