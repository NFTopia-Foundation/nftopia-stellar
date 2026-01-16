// create-collection.dto.ts
import { IsString, IsUrl, IsNotEmpty, IsOptional } from 'class-validator';
import { UserResponseDto } from '../../users/dto/create-user.dto';


export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUrl()
  @IsNotEmpty()
  bannerImage: string;
}

// update-collection.dto.ts
// import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  bannerImage?: string;
}

// collection-response.dto.ts

export class CollectionResponseDto {
  id: string;
  name: string;
  description: string;
  bannerImage: string;
  creator: UserResponseDto;
  createdAt: Date;
}