import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  bannerUrl?: string;

  @IsOptional()
  @Matches(/^@?[A-Za-z0-9_]{1,15}$/, {
    message: 'twitterHandle must be a valid Twitter handle',
  })
  twitterHandle?: string;

  @IsOptional()
  @Matches(/^@?[A-Za-z0-9_.]{1,30}$/, {
    message: 'instagramHandle must be a valid Instagram handle',
  })
  instagramHandle?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;
}
