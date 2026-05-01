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
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { GraphqlContext } from '../context/context.interface';
import { GraphqlUserType } from '../types/user.types';
import type { User } from '../../users/user.entity';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { UsersService } from '../../users/users.service';
import { NftService } from '../../modules/nft/nft.service';
import { ListingService } from '../../modules/listing/listing.service';
import { AuctionService } from '../../modules/auction/auction.service';
import { OrderService } from '../../modules/order/order.service';
import { PaginationInput } from '../inputs/nft.inputs';
import { NFTConnection, GraphqlNft } from '../types/nft.types';
import {
  ListingConnection,
  GraphqlListing,
  ListingStatus,
} from '../types/listing.types';
import {
  AuctionConnection,
  GraphqlAuction,
  AuctionStatus,
} from '../types/auction.types';
import { GraphqlOrder, OrderConnection } from '../types/order.types';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import type { Listing } from '../../modules/listing/entities/listing.entity';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { OrderInterface } from '../../modules/order/interfaces/order.interface';

@Resolver(() => GraphqlUserType)
export class UserResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly nftService: NftService,
    private readonly listingService: ListingService,
    private readonly auctionService: AuctionService,
    private readonly orderService: OrderService,
  ) {}

  @Query(() => GraphqlUserType, {
    name: 'user',
    description: 'Fetch a single user by ID',
  })
  async user(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType> {
    const user = await context.loaders.userById.load(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toGraphqlUser(user);
  }

  @Query(() => GraphqlUserType, {
    name: 'me',
    description: 'Fetch the currently authenticated user',
  })
  @UseGuards(GqlAuthGuard)
  async me(@Context() context: GraphqlContext): Promise<GraphqlUserType> {
    const userId = context.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }

    const user = await context.loaders.userById.load(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toGraphqlUser(user);
  }

  @Query(() => GraphqlUserType, {
    name: 'userByAddress',
    nullable: true,
    description: 'Fetch a user by Stellar address',
  })
  async userByAddress(
    @Args('address', { type: () => String }) address: string,
  ): Promise<GraphqlUserType | null> {
    const user = await this.usersService.findByStellarAddress(address);
    return user ? this.toGraphqlUser(user) : null;
  }

  @ResolveField(() => NFTConnection, {
    name: 'nfts',
    nullable: true,
    description: 'Fetch NFTs created by this user',
  })
  async nfts(
    @Parent() user: GraphqlUserType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<NFTConnection> {
    const first = pagination?.first ?? 20;
    const result = await this.nftService.findConnection({
      first,
      after: pagination?.after
        ? this.decodeCursor(pagination.after)
        : undefined,
      creatorId: user.id,
    });

    return this.toNftConnection(result.data, result.total, result.hasNextPage);
  }

  @ResolveField(() => NFTConnection, {
    name: 'ownedNFTs',
    nullable: true,
    description: 'Fetch NFTs owned by this user',
  })
  async ownedNFTs(
    @Parent() user: GraphqlUserType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<NFTConnection> {
    const first = pagination?.first ?? 20;
    const result = await this.nftService.findConnection({
      first,
      after: pagination?.after
        ? this.decodeCursor(pagination.after)
        : undefined,
      ownerId: user.id,
    });

    return this.toNftConnection(result.data, result.total, result.hasNextPage);
  }

  @ResolveField(() => ListingConnection, {
    name: 'listings',
    nullable: true,
    description: 'Fetch listings created by this user',
  })
  async listings(
    @Parent() user: GraphqlUserType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<ListingConnection> {
    const first = pagination?.first ?? 20;
    const result = await this.listingService.findConnection({
      first,
      after: pagination?.after
        ? this.decodeCursor(pagination.after)
        : undefined,
      sellerId: user.id,
    });

    return this.toListingConnection(
      result.data,
      result.total,
      result.hasNextPage,
    );
  }

  @ResolveField(() => AuctionConnection, {
    name: 'auctions',
    nullable: true,
    description: 'Fetch auctions created by this user',
  })
  async auctions(
    @Parent() user: GraphqlUserType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<AuctionConnection> {
    const limit = pagination?.first ?? 20;
    const page = pagination?.after ? Number(pagination.after) || 1 : 1;
    const auctions = await this.auctionService.findAll({
      sellerId: user.id,
      page,
      limit,
    });

    return this.toAuctionConnection(auctions, page, limit);
  }

  @ResolveField(() => OrderConnection, {
    name: 'purchases',
    nullable: true,
    description: 'Fetch purchase orders for this user',
  })
  async purchases(
    @Parent() user: GraphqlUserType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<OrderConnection> {
    const limit = pagination?.first ?? 20;
    const page = pagination?.after ? Number(pagination.after) || 1 : 1;
    const orders = await this.orderService.findAll({
      buyerId: user.id,
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return this.toOrderConnection(orders, page, limit);
  }

  @ResolveField(() => OrderConnection, {
    name: 'sales',
    nullable: true,
    description: 'Fetch sale orders for this user',
  })
  async sales(
    @Parent() user: GraphqlUserType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<OrderConnection> {
    const limit = pagination?.first ?? 20;
    const page = pagination?.after ? Number(pagination.after) || 1 : 1;
    const orders = await this.orderService.findAll({
      sellerId: user.id,
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return this.toOrderConnection(orders, page, limit);
  }

  private toGraphqlUser(user: User): GraphqlUserType {
    return {
      id: user.id,
      username: user.username ?? null,
      email: user.email ?? null,
      walletAddress: user.walletAddress ?? user.address ?? null,
      stellarAddress: user.walletAddress ?? user.address ?? null,
      avatar: user.avatarUrl ?? null,
    };
  }

  private toNftConnection(
    nfts: Nft[],
    totalCount: number,
    hasNextPage: boolean,
  ): NFTConnection {
    const edges = nfts.map((nft) => ({
      node: this.toGraphqlNft(nft),
      cursor: this.encodeCursor(nft.createdAt, nft.id),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        startCursor: edges[0]?.cursor,
        endCursor: edges.at(-1)?.cursor,
      },
      totalCount,
    };
  }

  private toListingConnection(
    listings: Listing[],
    totalCount: number,
    hasNextPage: boolean,
  ): ListingConnection {
    const edges = listings.map((listing) => ({
      node: this.toGraphqlListing(listing),
      cursor: this.encodeCursor(listing.createdAt, listing.id),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        startCursor: edges[0]?.cursor,
        endCursor: edges.at(-1)?.cursor,
      },
      totalCount,
    };
  }

  private toAuctionConnection(
    auctions: Auction[],
    page: number,
    limit: number,
  ): AuctionConnection {
    const edges = auctions.map((auction) => ({
      node: this.toGraphqlAuction(auction),
      cursor: auction.id,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: auctions.length === limit,
        startCursor: edges[0]?.cursor,
        endCursor: String(page + 1),
      },
      totalCount: auctions.length,
    };
  }

  private toOrderConnection(
    orders: OrderInterface[],
    page: number,
    limit: number,
  ): OrderConnection {
    const edges = orders.map((order) => ({
      node: this.toGraphqlOrder(order),
      cursor: order.id,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: orders.length === limit,
        startCursor: edges[0]?.cursor,
        endCursor: String(page + 1),
      },
      totalCount: orders.length,
    };
  }

  private toGraphqlNft(nft: Nft): GraphqlNft {
    return {
      id: nft.id,
      tokenId: nft.tokenId,
      contractAddress: nft.contractAddress,
      name: nft.name,
      description: nft.description ?? null,
      image: nft.imageUrl ?? null,
      attributes: (nft.attributes ?? []).map((attribute) => ({
        traitType: attribute.traitType,
        value: attribute.value,
        ...(attribute.displayType
          ? { displayType: attribute.displayType }
          : {}),
      })),
      ownerId: nft.ownerId,
      creatorId: nft.creatorId,
      collectionId: nft.collectionId ?? null,
      mintedAt: nft.mintedAt,
      lastPrice: nft.lastPrice ?? null,
    };
  }

  private toGraphqlListing(listing: Listing): GraphqlListing {
    return {
      id: listing.id,
      nftId: `${listing.nftContractId}:${listing.nftTokenId}`,
      sellerId: listing.sellerId,
      price: this.toDecimalString(listing.price),
      currency: listing.currency,
      status: listing.status as ListingStatus,
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt ?? null,
    };
  }

  private toGraphqlAuction(auction: Auction): GraphqlAuction {
    return {
      id: auction.id,
      nftId: `${auction.nftContractId}:${auction.nftTokenId}`,
      sellerId: auction.sellerId,
      startPrice: this.toDecimalString(auction.startPrice),
      currentPrice: this.toDecimalString(auction.currentPrice),
      reservePrice: this.toDecimalString(auction.reservePrice),
      startTime: auction.startTime,
      endTime: auction.endTime,
      status: auction.status as AuctionStatus,
      winnerId: auction.winnerId ?? null,
      bids: undefined,
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
      type: order.type,
      status: order.status,
      transactionHash: order.transactionHash,
      createdAt: order.createdAt,
    };
  }

  private toDecimalString(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '0.0000000';
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return '0.0000000';
    }

    return parsed.toFixed(7);
  }

  private encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: createdAt.toISOString(),
        id,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: string; id: string } {
    const payload = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { createdAt: string; id: string };

    return {
      createdAt: payload.createdAt,
      id: payload.id,
    };
  }
}
