// auction/dto/create-auction.dto.ts
import { IsUUID, IsDateString, IsNumber, IsOptional } from 'class-validator';

export class CreateAuctionDto {
  @IsUUID()
  nftId: string;

  @IsNumber()
  startingPrice: number;

  @IsDateString()
  endsAt: string; // ISO string
}

// auction/dto/update-auction.dto.ts

export class UpdateAuctionDto {
  @IsOptional()
  @IsNumber()
  startingPrice?: number;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

// auction/dto/auction-response.dto.ts
export class AuctionResponseDto {
    id: string;
    nftId: string;
    sellerId: string;
    startingPrice: number;
    endsAt: string;
    isActive: boolean;
    createdAt: string;
  }
  
