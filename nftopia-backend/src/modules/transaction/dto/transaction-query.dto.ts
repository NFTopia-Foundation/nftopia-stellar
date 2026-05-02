import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TransactionState } from '../enums/transaction-state.enum';

export class TransactionQueryDto {
  @IsOptional()
  @IsEnum(TransactionState)
  state?: TransactionState;

  @IsOptional()
  @IsString()
  nftId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
