import {
  IsUUID,
  IsString,
  IsNumberString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum OrderType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
}

export enum OrderStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export class CreateOrderDto {
  @IsUUID()
  nftId: string;

  @IsUUID()
  buyerId: string;

  @IsUUID()
  sellerId: string;

  @IsNumberString()
  price: string;

  @IsString()
  currency?: string;

  @IsEnum(OrderType)
  type: OrderType;

  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsString()
  @IsOptional()
  transactionHash?: string;

  @IsUUID()
  @IsOptional()
  listingId?: string;

  @IsUUID()
  @IsOptional()
  auctionId?: string;
}
