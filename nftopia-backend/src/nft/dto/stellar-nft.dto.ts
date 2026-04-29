import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class StellarNftDto {
  @ApiProperty({ description: 'Stellar Contract ID (C...)' })
  @IsString()
  @Length(56, 56)
  @Matches(/^C[A-Z0-9]{55}$/, { message: 'Invalid Stellar Contract ID format' })
  contractId: string;

  @ApiProperty({ description: 'Token ID (uint256 or string)' })
  @IsString()
  tokenId: string;

  @ApiProperty({ description: 'Owner Account ID (G...)' })
  @IsString()
  @Length(56, 56)
  @Matches(/^G[A-Z0-9]{55}$/, { message: 'Invalid Stellar Account ID format' })
  owner: string;

  @ApiProperty({ required: false, description: 'IPFS or HTTP URI' })
  @IsString()
  @IsOptional()
  metadataUri?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  image?: string;
}
