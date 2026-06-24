import { OrderInterface } from '../interfaces/order.interface';

export interface OrderPaginatedResponseDto {
  items: OrderInterface[];
  totalCount: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}
