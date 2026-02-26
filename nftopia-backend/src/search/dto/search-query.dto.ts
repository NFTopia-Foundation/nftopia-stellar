import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @ApiProperty({ description: 'Search query string' })
  @IsString()
  q: string;

  @ApiProperty({ required: false, enum: ['nfts', 'users', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['nfts', 'users', 'all'])
  type?: 'nfts' | 'users' | 'all' = 'all';

  @ApiProperty({ required: false, description: 'Filter by contract ID (collection)' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiProperty({ required: false, description: 'Filter by owner address' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiProperty({ required: false, description: 'MeiliSearch filter expression' })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiProperty({ required: false, description: 'Sort, e.g. mintedAt:desc', example: 'mintedAt:desc' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
