import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class NftImageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quality?: number;

  @IsOptional()
  @IsIn(['auto', 'webp', 'avif', 'jpeg', 'png', 'original'])
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png' | 'original';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  signed?: boolean;

  @IsOptional()
  expires?: string;

  @IsOptional()
  signature?: string;

  @IsOptional()
  v?: string;
}
