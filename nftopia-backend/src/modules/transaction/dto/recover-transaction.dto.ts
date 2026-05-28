import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecoverTransactionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  strategy?: string;
}
