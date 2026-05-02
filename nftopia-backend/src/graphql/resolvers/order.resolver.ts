import {
  Args,
  Context,
  ID,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { UseGuards } from '@nestjs/common';
import { OrderService } from '../../modules/order/order.service';
import {
  GraphqlOrder,
  OrderConnection,
  SalesAnalytics,
} from '../types/order.types';
import { GraphqlUserType } from '../types/user.types';
import { GraphqlNft } from '../types/nft.types';
import { TimeframeInput } from '../inputs/order.inputs';
import { PaginationInput } from '../inputs/nft.inputs';
import type { GraphqlContext } from '../context/context.interface';
import type { OrderQueryDto } from '../../modules/order/dto/order-query.dto';
import type { OrderInterface } from '../../modules/order/interfaces/order.interface';
import type { User } from '../../users/user.entity';
import type { Nft } from '../../modules/nft/entities/nft.entity';
// import { UserRole } from '../../common/enums/user-role.enum';

@Resolver(() => GraphqlOrder)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Query(() => GraphqlOrder, {
    name: 'order',
    description: 'Fetch single order by ID',
  })
  @UseGuards(GqlAuthGuard)
  async order(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GraphqlOrder> {
    const order = await this.orderService.findOne(id);
    if (!order) throw new NotFoundException('Order not found');
    return this.toGraphqlOrder(order);
  }

  @Query(() => OrderConnection, {
    name: 'myOrders',
    description: "Fetch current user's orders (authenticated)",
  })
  @UseGuards(GqlAuthGuard)
  async myOrders(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination: PaginationInput,
    @Args('type', { type: () => String, nullable: true }) type: string,
    @Context() context: GraphqlContext,
  ): Promise<OrderConnection> {
    const userId = context.user?.userId;
    if (!userId) throw new BadRequestException('User not authenticated');
    // Map PaginationInput to OrderQueryDto fields
    const query: OrderQueryDto = {};
    if (pagination?.first) query.limit = pagination.first;
    if (pagination?.after) query.page = Number(pagination.after) || 1;
    if (type === 'SALE') {
      query.sellerId = userId;
    } else if (type === 'PURCHASE') {
      query.buyerId = userId;
    } else {
      // If neither, fetch both as separate queries and merge
      const sellerQuery: OrderQueryDto = { ...pagination, sellerId: userId };
      const buyerQuery: OrderQueryDto = { ...pagination, buyerId: userId };
      const [sellerOrders, buyerOrders] = await Promise.all([
        this.orderService.findAll(sellerQuery),
        this.orderService.findAll(buyerQuery),
      ]);
      // Remove duplicates by id
      const merged: Record<string, OrderInterface> = {};
      sellerOrders.forEach((o) => (merged[o.id] = o));
      buyerOrders.forEach((o) => (merged[o.id] = o));
      return this.toConnection(Object.values(merged));
    }
    const orders = await this.orderService.findAll(query);
    return this.toConnection(orders);
  }

  @Query(() => OrderConnection, {
    name: 'userOrders',
    description: 'Fetch orders for specific user',
  })
  @UseGuards(GqlAuthGuard)
  async userOrders(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination: PaginationInput,
  ): Promise<OrderConnection> {
    const query: OrderQueryDto = { ...pagination, buyerId: userId };
    const orders = await this.orderService.findAll(query);
    return this.toConnection(orders);
  }

  @Query(() => [GraphqlOrder], {
    name: 'nftOrders',
    description: 'Fetch order history for NFT',
  })
  @UseGuards(GqlAuthGuard)
  async nftOrders(
    @Args('nftId', { type: () => ID }) nftId: string,
  ): Promise<GraphqlOrder[]> {
    const query: OrderQueryDto = { nftId };
    const orders = await this.orderService.findAll(query);
    return orders.map((order: OrderInterface) => this.toGraphqlOrder(order));
  }

  @Query(() => SalesAnalytics, {
    name: 'salesAnalytics',
    description: 'Fetch sales analytics (admin only)',
  })
  @UseGuards(GqlAuthGuard)
  salesAnalytics(
    @Args('timeframe', { type: () => TimeframeInput })
    timeframe: TimeframeInput,
  ): Promise<SalesAnalytics> {
    // TODO: Implement admin check using a real user lookup if needed
    const stats = this.orderService.getSalesAnalytics();
    return Promise.resolve({
      totalVolume: stats.volume,
      totalSales: stats.count,
      averagePrice: stats.averagePrice,
      periodStart: new Date(timeframe.periodStart),
      periodEnd: new Date(timeframe.periodEnd),
    });
  }

  @ResolveField(() => GraphqlUserType, {
    name: 'buyer',
    nullable: true,
    description: 'Resolve order buyer using request-scoped DataLoader',
  })
  async buyer(
    @Parent() order: GraphqlOrder,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType | null> {
    const buyer = await context.loaders.userById.load(order.buyerId);
    if (!buyer) {
      return null;
    }

    return this.toGraphqlUser(buyer);
  }

  @ResolveField(() => GraphqlUserType, {
    name: 'seller',
    nullable: true,
    description: 'Resolve order seller using request-scoped DataLoader',
  })
  async seller(
    @Parent() order: GraphqlOrder,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType | null> {
    const seller = await context.loaders.userById.load(order.sellerId);
    if (!seller) {
      return null;
    }

    return this.toGraphqlUser(seller);
  }

  @ResolveField(() => GraphqlNft, {
    name: 'nft',
    nullable: true,
    description: 'Resolve order NFT using request-scoped DataLoader',
  })
  async nft(
    @Parent() order: GraphqlOrder,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlNft | null> {
    const nft = await context.loaders.nftById.load(order.nftId);
    if (!nft) {
      return null;
    }

    return this.toGraphqlNft(nft);
  }

  private toGraphqlOrder = (order: OrderInterface): GraphqlOrder => ({
    id: order.id,
    nftId: order.nftId,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    price: order.price,
    currency: order.currency,
    type: order.type,
    status: order.status,
    transactionHash: order.transactionHash,
    createdAt: order.createdAt,
  });

  private toGraphqlUser = (user: User): GraphqlUserType => ({
    id: user.id,
    username: user.username ?? null,
    email: user.email ?? null,
    walletAddress: user.walletAddress ?? user.address ?? null,
    stellarAddress: user.walletAddress ?? user.address ?? null,
    avatar: user.avatarUrl ?? null,
  });

  private toGraphqlNft = (nft: Nft): GraphqlNft => ({
    id: nft.id,
    tokenId: nft.tokenId,
    contractAddress: nft.contractAddress,
    name: nft.name,
    description: nft.description ?? null,
    image: nft.imageUrl ?? null,
    attributes: (nft.attributes ?? []).map((attribute) => ({
      traitType: attribute.traitType,
      value: attribute.value,
      ...(attribute.displayType ? { displayType: attribute.displayType } : {}),
    })),
    ownerId: nft.ownerId,
    creatorId: nft.creatorId,
    collectionId: nft.collectionId ?? null,
    mintedAt: nft.mintedAt,
    lastPrice: nft.lastPrice ?? null,
  });

  private toConnection = (orders: OrderInterface[]): OrderConnection => {
    const edges = orders.map((order) => ({
      node: this.toGraphqlOrder(order),
      cursor: order.id,
    }));
    return {
      edges,
      pageInfo: {
        hasNextPage: false, // TODO: implement real pagination
        startCursor: edges[0]?.cursor,
        endCursor: edges.at(-1)?.cursor,
      },
      totalCount: orders.length,
    };
  };
}
