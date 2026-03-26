import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  symbol: string;

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
  bannerImageUrl?: string;

  @IsOptional()
  @IsString()
  @Length(56, 56)
  contractAddress?: string;
}
