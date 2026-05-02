import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class BatchExecuteTransactionsDto {
  @IsArray()
  @ArrayMaxSize(50)
  ids: number[];

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxGas?: number;
}
