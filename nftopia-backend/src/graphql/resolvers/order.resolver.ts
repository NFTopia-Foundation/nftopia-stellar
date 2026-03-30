import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { OrderService } from '../../modules/order/order.service';
import { OrderInterface } from '../../modules/order/interfaces/order.interface';
import {
  OrderType,
  OrderStatus,
} from '../../modules/order/dto/create-order.dto';
import {
  GraphqlOrder,
  GraphqlOrderStats,
  OrderConnection,
} from '../types/order.types';
import { OrderFilterInput } from '../inputs/order.inputs';
import { PaginationInput } from '../inputs/nft.inputs';
import { PageInfo } from '../types/nft.types';

@Resolver(() => GraphqlOrder)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Query(() => GraphqlOrder, {
    name: 'order',
    description: 'Fetch a single order by ID',
  })
  async order(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GraphqlOrder> {
    const order = await this.orderService.findOne(id);
    return this.toGraphqlOrder(order);
  }

  @Query(() => OrderConnection, {
    name: 'orders',
    description: 'Fetch orders with pagination and optional filters',
  })
  async orders(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('filter', { type: () => OrderFilterInput, nullable: true })
    filter?: OrderFilterInput,
  ): Promise<OrderConnection> {
    const limit = pagination?.first ?? 20;

    const items = await this.orderService.findAll({
      nftId: filter?.nftId,
      buyerId: filter?.buyerId,
      sellerId: filter?.sellerId,
      type: filter?.type,
      status: filter?.status,
      page: 1,
      limit,
    });

    return this.toConnection(items, items.length, false);
  }

  @Query(() => GraphqlOrderStats, {
    name: 'orderStats',
    description: 'Fetch aggregated order statistics for an NFT',
  })
  async orderStats(
    @Args('nftId', { type: () => ID }) nftId: string,
  ): Promise<GraphqlOrderStats> {
    return this.orderService.getStats(nftId);
  }

  private toConnection(
    items: OrderInterface[],
    totalCount: number,
    hasNextPage: boolean,
  ): OrderConnection {
    const edges = items.map((o) => ({
      node: this.toGraphqlOrder(o),
      cursor: Buffer.from(o.createdAt.toISOString() + ':' + o.id, 'utf8').toString('base64url'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        startCursor: edges[0]?.cursor,
        endCursor: edges.at(-1)?.cursor,
      } as PageInfo,
      totalCount,
    };
  }

  private toGraphqlOrder(order: OrderInterface): GraphqlOrder {
    return {
      id: order.id,
      nftId: order.nftId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      price: order.price,
      currency: order.currency,
      type: order.type as OrderType,
      status: order.status as OrderStatus,
      transactionHash: order.transactionHash,
      listingId: order.listingId,
      auctionId: order.auctionId,
      createdAt: order.createdAt,
    };
  }
}
