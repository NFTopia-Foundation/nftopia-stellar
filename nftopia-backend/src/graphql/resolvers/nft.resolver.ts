import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import type { GraphqlContext } from '../context/context.interface';
import {
  MintNFTInput,
  NFTFilterInput,
  PaginationInput,
  UpdateNFTMetadataInput,
} from '../inputs/nft.inputs';
import { GraphqlNft, NFTConnection } from '../types/nft.types';
import { NftService } from '../../modules/nft/nft.service';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import { GraphqlCollection } from '../types/collection.types';
import type { Collection } from '../../modules/collection/entities/collection.entity';
import { GraphqlListing, ListingStatus } from '../types/listing.types';
import type { Listing } from '../../modules/listing/entities/listing.entity';
import { GraphqlOrder } from '../types/order.types';
import type { OrderInterface } from '../../modules/order/interfaces/order.interface';
import { GraphqlUserType } from '../types/user.types';
import { GraphqlAuction, AuctionStatus } from '../types/auction.types';
import type { User } from '../../users/user.entity';
import type { Auction } from '../../modules/auction/entities/auction.entity';

type CursorPayload = {
  createdAt: string;
  id: string;
};

@Resolver(() => GraphqlNft)
export class NftResolver {
  constructor(private readonly nftService: NftService) {}

  @Query(() => GraphqlNft, {
    name: 'nft',
    description: 'Fetch a single NFT by ID',
  })
  async nft(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlNft> {
    const nft = await context.loaders.nftById.load(id);
    if (!nft) {
      throw new NotFoundException('NFT not found');
    }

    return this.toGraphqlNft(nft);
  }

  @Query(() => NFTConnection, {
    name: 'nfts',
    description: 'Fetch NFTs with cursor pagination and optional filters',
  })
  async nfts(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('filter', { type: () => NFTFilterInput, nullable: true })
    filter?: NFTFilterInput,
  ): Promise<NFTConnection> {
    const first = pagination?.first ?? 20;
    const after = pagination?.after
      ? this.decodeCursor(pagination.after)
      : undefined;

    const result = await this.nftService.findConnection({
      first,
      after,
      ownerId: filter?.ownerId,
      creatorId: filter?.creatorId,
      collectionId: filter?.collectionId,
      search: filter?.search,
      includeBurned: filter?.includeBurned,
    });

    return this.toConnection(result.data, result.total, result.hasNextPage);
  }

  @Query(() => NFTConnection, {
    name: 'nftsByOwner',
    description: 'Fetch NFTs owned by a specific user',
  })
  async nftsByOwner(
    @Args('ownerId', { type: () => ID }) ownerId: string,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<NFTConnection> {
    const first = pagination?.first ?? 20;
    const after = pagination?.after
      ? this.decodeCursor(pagination.after)
      : undefined;

    const result = await this.nftService.findConnection({
      first,
      after,
      ownerId,
    });

    return this.toConnection(result.data, result.total, result.hasNextPage);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlNft, {
    name: 'mintNFT',
    description: 'Mint a new NFT',
  })
  async mintNFT(
    @Args('input', { type: () => MintNFTInput }) input: MintNFTInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlNft> {
    const callerId = this.getAuthenticatedUserId(context);
    const nft = await this.nftService.mint(
      {
        tokenId: input.tokenId,
        contractAddress: input.contractAddress,
        name: input.name,
        description: input.description,
        imageUrl: input.image,
        animationUrl: input.animationUrl,
        externalUrl: input.externalUrl,
        ownerId: input.ownerId,
        creatorId: input.creatorId,
        collectionId: input.collectionId,
        lastPrice: input.lastPrice,
        attributes: input.attributes,
      },
      callerId,
    );

    return this.toGraphqlNft(nft);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlNft, {
    name: 'updateNFTMetadata',
    description: 'Update NFT metadata',
  })
  async updateNFTMetadata(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateNFTMetadataInput })
    input: UpdateNFTMetadataInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlNft> {
    const callerId = this.getAuthenticatedUserId(context);
    const nft = await this.nftService.update(
      id,
      {
        name: input.name,
        description: input.description,
        imageUrl: input.image,
        animationUrl: input.animationUrl,
        externalUrl: input.externalUrl,
        collectionId: input.collectionId,
        lastPrice: input.lastPrice,
        attributes: input.attributes,
      },
      callerId,
    );

    return this.toGraphqlNft(nft);
  }

  @ResolveField(() => GraphqlUserType, {
    name: 'owner',
    nullable: true,
    description: 'Resolve NFT owner using request-scoped DataLoader',
  })
  async owner(
    @Parent() nft: GraphqlNft,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType | null> {
    const owner = await context.loaders.userById.load(nft.ownerId);
    if (!owner) {
      return null;
    }

    return this.toGraphqlUser(owner);
  }

  @ResolveField(() => GraphqlUserType, {
    name: 'creator',
    nullable: true,
    description: 'Resolve NFT creator using request-scoped DataLoader',
  })
  async creator(
    @Parent() nft: GraphqlNft,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType | null> {
    const creator = await context.loaders.userById.load(nft.creatorId);
    if (!creator) {
      return null;
    }

    return this.toGraphqlUser(creator);
  }

  @ResolveField(() => GraphqlCollection, {
    name: 'collection',
    nullable: true,
    description: 'Resolve NFT collection using request-scoped DataLoader',
  })
  async collection(
    @Parent() nft: GraphqlNft,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlCollection | null> {
    if (!nft.collectionId) {
      return null;
    }

    const collection = await context.loaders.collectionById.load(nft.collectionId);
    if (!collection) {
      return null;
    }

    return this.toGraphqlCollection(collection);
  }

  @ResolveField(() => GraphqlListing, {
    name: 'listing',
    nullable: true,
    description: 'Resolve active listing by NFT using request-scoped DataLoader',
  })
  async listing(
    @Parent() nft: GraphqlNft,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlListing | null> {
    const listing = await context.loaders.listingByNftId.load(nft.id);
    if (!listing) {
      return null;
    }

    return this.toGraphqlListing(listing);
  }

  @ResolveField(() => GraphqlAuction, {
    name: 'auction',
    nullable: true,
    description: 'Resolve active auction by NFT using request-scoped DataLoader',
  })
  async auction(
    @Parent() nft: GraphqlNft,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlAuction | null> {
    const auction = await context.loaders.auctionByNftId.load(nft.id);
    if (!auction) {
      return null;
    }

    return this.toGraphqlAuction(auction);
  }

  @ResolveField(() => [GraphqlOrder], {
    name: 'orders',
    description: 'Resolve NFT orders using request-scoped DataLoader',
  })
  async orders(
    @Parent() nft: GraphqlNft,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlOrder[]> {
    const orders = await context.loaders.ordersByNftId.load(nft.id);
    return orders.map((order) => this.toGraphqlOrder(order));
  }

  private getAuthenticatedUserId(context: GraphqlContext): string {
    const userId = context.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }

    return userId;
  }

  private toConnection(
    nfts: Nft[],
    totalCount: number,
    hasNextPage: boolean,
  ): NFTConnection {
    const edges = nfts.map((nft) => ({
      node: this.toGraphqlNft(nft),
      cursor: this.encodeCursor(nft),
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

  private toGraphqlCollection(collection: Collection): GraphqlCollection {
    return {
      id: collection.id,
      contractAddress: collection.contractAddress,
      name: collection.name,
      symbol: collection.symbol,
      description: collection.description ?? null,
      image: collection.imageUrl,
      creatorId: collection.creatorId,
      totalVolume: this.toDecimalString(collection.totalVolume),
      floorPrice: this.toDecimalString(collection.floorPrice),
      totalSupply: collection.totalSupply,
      createdAt: collection.createdAt,
      nfts: undefined,
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

  private toGraphqlUser(user: User): GraphqlUserType {
    return {
      id: user.id,
      username: user.username ?? null,
      email: user.email ?? null,
      walletAddress: user.walletAddress ?? user.address ?? null,
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

  private encodeCursor(nft: Pick<Nft, 'createdAt' | 'id'>): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: nft.createdAt.toISOString(),
        id: nft.id,
      } satisfies CursorPayload),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload {
    try {
      const payload = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as Partial<CursorPayload>;

      if (!payload.createdAt || !payload.id) {
        throw new Error('Cursor is missing fields');
      }

      if (Number.isNaN(Date.parse(payload.createdAt))) {
        throw new Error('Cursor contains invalid createdAt');
      }

      return {
        createdAt: payload.createdAt,
        id: payload.id,
      };
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }
}
