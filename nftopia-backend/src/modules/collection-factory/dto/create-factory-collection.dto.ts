import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateFactoryCollectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsNotEmpty()
  owner: string;

  @IsOptional()
  @IsString()
  metadataUri?: string;

  @ValidateIf(
    (dto: CreateFactoryCollectionDto) => dto.royaltyRecipient !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  royaltyRecipient?: string;

  @ValidateIf(
    (dto: CreateFactoryCollectionDto) => dto.royaltyPercentage !== undefined,
  )
  @IsNumber()
  @Min(0)
  @Max(100)
  royaltyPercentage?: number;
}
