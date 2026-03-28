import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  @Length(56, 56)
  @Matches(/^[A-Z2-7]{56}$/)
  contractAddress: string;

  @IsString()
  @Length(1, 255)
  name: string;

  @IsString()
  @Length(1, 50)
  symbol: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUrl()
  @Length(1, 500)
  imageUrl: string;

  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  bannerImageUrl?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;
}
