import { IsString, MaxLength } from 'class-validator';

export class SignTransactionDto {
  @IsString()
  @MaxLength(255)
  signature: string;
}
