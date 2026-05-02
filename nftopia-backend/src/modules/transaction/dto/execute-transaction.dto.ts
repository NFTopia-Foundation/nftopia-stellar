import { IsNumber, IsOptional, Min } from 'class-validator';

export class ExecuteTransactionDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxGas?: number;

  @IsOptional()
  config?: Record<string, unknown>;
}
