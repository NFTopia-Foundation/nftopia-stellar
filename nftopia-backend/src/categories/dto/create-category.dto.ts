// src/categories/dto/create-category.dto.ts
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { NFT } from '../../nfts/entities/nft.entity'; 
import { Exclude } from 'class-transformer';



export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}


export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}


export class CategoryResponseDto {
  id: number;
  name: string;
  description?: string;

  @Exclude() // Excluding nfts if not needed in the response
  nfts?: NFT[];
}
