import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUrl, IsBoolean } from 'class-validator';

export class CreateNftDto {
  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUrl()
  @IsNotEmpty()
  image: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string = 'STK'; // Default value

  @IsString()
  @IsNotEmpty()
  ownerId: string; // Reference to User ID

  @IsString()
  @IsOptional()
  collectionId?: string; // Optional collection reference

  @IsNumber()
  categoryId: number; // The ID of the category this NFT belongs to

  @IsBoolean()
  @IsOptional()
  isListed?: boolean = false; // Default value
}

export class UpdateNftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  tokenUri?: string;

  @IsOptional()
  @IsNumber()
  categoryId?: number; // Optional category update
}
