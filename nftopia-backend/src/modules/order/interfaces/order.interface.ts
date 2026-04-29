import { OrderStatus, OrderType } from '../dto/create-order.dto';

export interface OrderInterface {
  id: string;
  nftId: string;
  buyerId: string;
  sellerId: string;
  price: string;
  currency: string;
  type: OrderType;
  status: OrderStatus;
  transactionHash?: string;
  listingId?: string;
  auctionId?: string;
  createdAt: Date;
}

export interface OrderStats {
  volume: string;
  count: number;
  averagePrice: string;
}
