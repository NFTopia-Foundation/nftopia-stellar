import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  symbol?: string;

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
}
