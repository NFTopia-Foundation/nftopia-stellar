import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
  Min,
} from 'class-validator';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  nftContractId: string;

  @IsString()
  @IsNotEmpty()
  nftTokenId: string;

  @IsNumber()
  @Min(0.0000001)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsISO8601()
  @IsOptional()
  expiresAt?: string;
}
