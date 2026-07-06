import {
  Args,
  Context,
  ID,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { GqlRolesGuard } from '../../common/guards/gql-roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
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
import type { OrderPaginatedResponseDto } from '../../modules/order/dto/order-paginated-response.dto';
import type { OrderInterface } from '../../modules/order/interfaces/order.interface';
import type { User } from '../../users/user.entity';
import type { Nft } from '../../modules/nft/entities/nft.entity';

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

    if (type === 'SALE') {
      const query: OrderQueryDto = {
        sellerId: userId,
        page: pagination?.after ? Number(pagination.after) : 1,
        limit: pagination?.first || 20,
      };
      const result = await this.orderService.findAllWithCount(query);
      return this.toConnection(result);
    } else if (type === 'PURCHASE') {
      const query: OrderQueryDto = {
        buyerId: userId,
        page: pagination?.after ? Number(pagination.after) : 1,
        limit: pagination?.first || 20,
      };
      const result = await this.orderService.findAllWithCount(query);
      return this.toConnection(result);
    } else {
      // If neither, fetch both as separate queries and merge
      const page = pagination?.after ? Number(pagination.after) : 1;
      const limit = pagination?.first || 20;

      const sellerQuery: OrderQueryDto = { sellerId: userId, page, limit };
      const buyerQuery: OrderQueryDto = { buyerId: userId, page, limit };

      const [sellerResult, buyerResult] = await Promise.all([
        this.orderService.findAllWithCount(sellerQuery),
        this.orderService.findAllWithCount(buyerQuery),
      ]);

      // Remove duplicates by id and merge
      const merged: Record<string, OrderInterface> = {};
      sellerResult.items.forEach((o) => (merged[o.id] = o));
      buyerResult.items.forEach((o) => (merged[o.id] = o));

      const mergedOrders = Object.values(merged);
      const totalCount = sellerResult.totalCount + buyerResult.totalCount;
      const hasNextPage = page * limit < totalCount;

      return this.toConnectionFromOrders(mergedOrders, {
        totalCount,
        page,
        limit,
        hasNextPage,
      });
    }
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
    const query: OrderQueryDto = {
      buyerId: userId,
      page: pagination?.after ? Number(pagination.after) : 1,
      limit: pagination?.first || 20,
    };
    const result = await this.orderService.findAllWithCount(query);
    return this.toConnection(result);
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
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async salesAnalytics(
    @Args('timeframe', { type: () => TimeframeInput })
    timeframe: TimeframeInput,
  ): Promise<SalesAnalytics> {
    const periodStart = new Date(timeframe.periodStart);
    const periodEnd = new Date(timeframe.periodEnd);

    // Validate timeframe
    if (periodEnd < periodStart) {
      throw new BadRequestException(
        'Invalid timeframe: periodEnd must be after periodStart',
      );
    }

    const stats = await this.orderService.getSalesAnalytics(
      periodStart,
      periodEnd,
    );
    return {
      totalVolume: stats.volume,
      totalSales: stats.count,
      averagePrice: stats.averagePrice,
      periodStart,
      periodEnd,
    };
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

  /**
   * Convert OrderPaginatedResponseDto to OrderConnection
   * Properly computes hasNextPage based on pagination info from service
   */
  private toConnection = (
    result: OrderPaginatedResponseDto,
  ): OrderConnection => {
    const edges = result.items.map((order) => ({
      node: this.toGraphqlOrder(order),
      cursor: order.id,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: result.hasNextPage,
        startCursor: edges[0]?.cursor,
        endCursor: edges.at(-1)?.cursor,
      },
      totalCount: result.totalCount,
    };
  };

  /**
   * Helper method to convert raw orders array with pagination info to OrderConnection
   * Used for merged queries (myOrders with both SALE and PURCHASE)
   */
  private toConnectionFromOrders = (
    orders: OrderInterface[],
    paginationInfo: {
      totalCount: number;
      page: number;
      limit: number;
      hasNextPage: boolean;
    },
  ): OrderConnection => {
    const edges = orders.map((order) => ({
      node: this.toGraphqlOrder(order),
      cursor: order.id,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: paginationInfo.hasNextPage,
        startCursor: edges[0]?.cursor,
        endCursor: edges.at(-1)?.cursor,
      },
      totalCount: paginationInfo.totalCount,
    };
  };
}
