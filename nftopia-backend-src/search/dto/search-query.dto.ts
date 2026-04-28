import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['all', 'nfts', 'profiles'])
  type?: 'all' | 'nfts' | 'profiles';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsString()
  traitType?: string;

  @IsOptional()
  @IsString()
  traitValue?: string;

  @IsOptional()
  @IsIn([
    'createdAt:asc',
    'createdAt:desc',
    'updatedAt:asc',
    'updatedAt:desc',
    'mintedAt:asc',
    'mintedAt:desc',
    'lastPrice:asc',
    'lastPrice:desc',
    'username:asc',
    'username:desc',
  ])
  sort?: string;
}
