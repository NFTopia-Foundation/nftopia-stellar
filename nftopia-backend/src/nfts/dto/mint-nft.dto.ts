import { IsString, IsNumber, IsOptional, IsUrl } from 'class-validator';

export class MintNftDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class CreateNftFromUrlDto extends MintNftDto {
  @IsUrl()
  imageUrl: string;
}
