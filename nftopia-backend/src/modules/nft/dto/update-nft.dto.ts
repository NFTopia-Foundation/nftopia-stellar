import {
  IsArray,
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
import { NftAttributeDto } from './create-nft.dto';

export class UpdateNftDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

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
