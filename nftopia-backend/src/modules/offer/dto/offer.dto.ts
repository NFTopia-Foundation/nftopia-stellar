import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiProperty({ description: 'NFT contract ID' })
  @IsString()
  @IsNotEmpty()
  nftId: string; // Combined contractId:tokenId or just contractId

  @ApiPropertyOptional({
    description: 'Specific token ID if nftId is contract',
  })
  @IsString()
  @IsOptional()
  nftTokenId?: string;

  @ApiProperty({ description: 'Amount to offer', minimum: 0.0000001 })
  @IsNumber()
  @Min(0.0000001)
  amount: number;

  @ApiPropertyOptional({ description: 'Asset currency', default: 'XLM' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ description: 'Expiration date in ISO8601' })
  @IsISO8601()
  @IsNotEmpty()
  expiresAt: string;

  @ApiProperty({ description: 'Bidder Stellar public key' })
  @IsString()
  @IsNotEmpty()
  bidderPublicKey: string;
}

export class AcceptOfferDto {
  @ApiProperty({ description: 'Owner public key' })
  @IsString()
  @IsNotEmpty()
  ownerPublicKey: string;
}
