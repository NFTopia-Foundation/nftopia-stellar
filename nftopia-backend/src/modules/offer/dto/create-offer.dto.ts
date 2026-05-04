import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
  IsPositive,
} from 'class-validator';

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  nftContractId: string;

  @IsString()
  @IsNotEmpty()
  nftTokenId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  /** Currency for the offer. Only XLM is supported. */
  @IsString()
  @IsOptional()
  currency?: string;

  /** ISO 8601 expiration timestamp for the offer. */
  @IsISO8601()
  @IsNotEmpty()
  expiresAt: string;
}
