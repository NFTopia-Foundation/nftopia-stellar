import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class NftAttributeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  traitType: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  value: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  displayType?: string;
}

export class CreateNftDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  tokenId: string;

  @IsString()
  @IsNotEmpty()
  @Length(56, 56)
  contractAddress: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  animationUrl?: string;

  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  externalUrl?: string;

  @IsUUID()
  ownerId: string;

  @IsUUID()
  creatorId: string;

  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0)
  lastPrice?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NftAttributeDto)
  attributes?: NftAttributeDto[];
}

export { NftAttributeDto };
