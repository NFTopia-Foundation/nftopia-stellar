// nft-response.dto.ts
import { UserResponseDto } from '../../users/dto/create-user.dto';
import { CollectionResponseDto } from '../../collections/dto/create-collection.dto';
import { NFTMetadata } from '../../interfaces/NFTMetadata';

// export class NftResponseDto {
//   id: string;
//   title: string;
//   description: string;
//   image: string;
//   price: number;
//   currency: string;
//   owner: UserResponseDto;
//   collection?: CollectionResponseDto;
// }

export class NftResponseDto {
  id: string;
  tokenId: string;
  title: string;
  description: string;
  image: string;
  metadata?: NFTMetadata;
  price: number;
  currency: string;
  owner: UserResponseDto;
  collection?: CollectionResponseDto;
  isListed: boolean;
  createdAt?: Date; // If you add this to your entity
}