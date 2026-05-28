import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelTransactionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
