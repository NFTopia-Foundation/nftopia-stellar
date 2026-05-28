import {
  ArrayMaxSize,
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

export class BatchCreateTransactionBlueprintDto {
  @IsString()
  @MaxLength(56)
  creatorId: string;

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
  operations?: Array<Record<string, unknown>>;
}

export class BatchCreateTransactionsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BatchCreateTransactionBlueprintDto)
  blueprints: BatchCreateTransactionBlueprintDto[];
}
