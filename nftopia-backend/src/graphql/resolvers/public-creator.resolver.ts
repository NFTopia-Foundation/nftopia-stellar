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
import { UsersService } from '../../users/users.service';
import { UserFollowService } from '../../users/user-follow.service';
import { NftService } from '../../modules/nft/nft.service';
import { CollectionService } from '../../modules/collection/collection.service';
import { ListingService } from '../../modules/listing/listing.service';
import { OrderService } from '../../modules/order/order.service';
import { PaginationInput } from '../inputs/nft.inputs';
import { NFTConnection, GraphqlNft } from '../types/nft.types';
import {
  CollectionConnection,
  GraphqlCollection,
} from '../types/collection.types';
import type { User } from '../../users/user.entity';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import type { Collection } from '../../modules/collection/entities/collection.entity';
import {
  CreatorActivityConnection,
  CreatorActivityItem,
  CreatorActivityKind,
  CreatorNftSort,
  FollowResultType,
  PublicCreatorType,
} from '../types/public-creator.types';

const IDENTIFIER_MAX_LENGTH = 100;

@Resolver(() => PublicCreatorType)
export class PublicCreatorResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly followService: UserFollowService,
    private readonly nftService: NftService,
    private readonly collectionService: CollectionService,
    private readonly listingService: ListingService,
    private readonly orderService: OrderService,
  ) {}

  @Query(() => PublicCreatorType, {
    name: 'publicCreator',
    description:
      'Fetch a public creator profile by id, username, or wallet address',
  })
  async publicCreator(
    @Args('identifier', { type: () => String }) identifier: string,
    @Context() context: GraphqlContext,
  ): Promise<PublicCreatorType> {
    this.assertValidIdentifier(identifier);
    const user = await this.usersService.findPublicCreator(identifier);
    if (!user || user.isBanned) {
      throw new NotFoundException('Creator not found');
    }
    return this.buildPublicCreator(user, context);
  }

  @Mutation(() => FollowResultType, {
    name: 'followCreator',
    description: 'Follow a creator (authenticated)',
  })
  @UseGuards(GqlAuthGuard)
  async followCreator(
    @Args('creatorId', { type: () => ID }) creatorId: string,
    @Context() context: GraphqlContext,
  ): Promise<FollowResultType> {
    const followerId = context.user?.userId;
    if (!followerId) {
      throw new UnauthorizedException('Authentication is required');
    }

    const creator = await this.usersService.findById(creatorId);
    if (!creator || creator.isBanned) {
      throw new NotFoundException('Creator not found');
    }

    await this.followService.follow(followerId, creatorId);
    const followerCount = await this.followService.followerCount(creatorId);

    return {
      success: true,
      followerCount,
      isFollowing: true,
    };
  }

  @Mutation(() => FollowResultType, {
    name: 'unfollowCreator',
    description: 'Unfollow a creator (authenticated)',
  })
  @UseGuards(GqlAuthGuard)
  async unfollowCreator(
    @Args('creatorId', { type: () => ID }) creatorId: string,
    @Context() context: GraphqlContext,
  ): Promise<FollowResultType> {
    const followerId = context.user?.userId;
    if (!followerId) {
      throw new UnauthorizedException('Authentication is required');
    }

    try {
      await this.followService.unfollow(followerId, creatorId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        const followerCount = await this.followService.followerCount(creatorId);
        return {
          success: true,
          followerCount,
          isFollowing: false,
        };
      }
      throw error;
    }

    const followerCount = await this.followService.followerCount(creatorId);
    return {
      success: true,
      followerCount,
      isFollowing: false,
    };
  }

  @ResolveField(() => NFTConnection, {
    name: 'nfts',
    nullable: true,
  })
  async nfts(
    @Parent() creator: PublicCreatorType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('sortBy', { type: () => CreatorNftSort, nullable: true })
    sortBy?: CreatorNftSort,
  ): Promise<NFTConnection> {
    const first = pagination?.first ?? 20;
    const resolvedSort = sortBy === CreatorNftSort.PRICE ? 'PRICE' : 'NEWEST';

    const result = await this.nftService.findConnection({
      first,
      after: pagination?.after
        ? this.decodeNftCursor(pagination.after)
        : undefined,
      creatorId: creator.id,
      sortBy: resolvedSort,
    });

    return this.toNftConnection(result.data, result.total, result.hasNextPage);
  }

  @ResolveField(() => CollectionConnection, {
    name: 'collections',
    nullable: true,
  })
  async collections(
    @Parent() creator: PublicCreatorType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<CollectionConnection> {
    const first = pagination?.first ?? 20;
    const result = await this.collectionService.findConnection({
      first,
      after: pagination?.after
        ? this.decodeCollectionCursor(pagination.after)
        : undefined,
      creatorId: creator.id,
    });

    return this.toCollectionConnection(
      result.data,
      result.total,
      result.hasNextPage,
    );
  }

  @ResolveField(() => CreatorActivityConnection, {
    name: 'activity',
    nullable: true,
  })
  async activity(
    @Parent() creator: PublicCreatorType,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<CreatorActivityConnection> {
    const first = Math.min(pagination?.first ?? 20, 50);
    const after = pagination?.after
      ? this.decodeActivityCursor(pagination.after)
      : undefined;

    const fetchSize = first + 1;
    const [minted, listings, sales] = await Promise.all([
      this.nftService.findConnection({
        first: fetchSize,
        creatorId: creator.id,
      }),
      this.listingService.findConnection({
        first: fetchSize,
        sellerId: creator.id,
      }),
      this.orderService.findAllWithCount({
        sellerId: creator.id,
        page: 1,
        limit: fetchSize,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      }),
    ]);

    const items: CreatorActivityItem[] = [
      ...minted.data.map((nft) => ({
        type: CreatorActivityKind.MINT,
        occurredAt: nft.mintedAt ?? nft.createdAt,
        nftId: nft.id,
        price: nft.lastPrice ?? null,
        currency: null,
      })),
      ...listings.data.map((listing) => ({
        type: CreatorActivityKind.LISTING,
        occurredAt: listing.createdAt,
        nftId: `${listing.nftContractId}:${listing.nftTokenId}`,
        price: this.toDecimalString(listing.price),
        currency: listing.currency,
      })),
      ...sales.items.map((order) => ({
        type: CreatorActivityKind.SALE,
        occurredAt: order.createdAt,
        nftId: order.nftId,
        price: order.price,
        currency: order.currency,
      })),
    ];

    items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const filtered = after
      ? items.filter(
          (item) =>
            item.occurredAt.getTime() < after.occurredAt.getTime() ||
            (item.occurredAt.getTime() === after.occurredAt.getTime() &&
              `${item.type}:${item.nftId ?? ''}` <
                `${after.type}:${after.nftId ?? ''}`),
        )
      : items;

    const page = filtered.slice(0, first);
    const edges = page.map((node) => ({
      node,
      cursor: this.encodeActivityCursor(node),
    }));

    return {
      edges,
      totalCount: items.length,
    };
  }

  private async buildPublicCreator(
    user: User,
    context: GraphqlContext,
  ): Promise<PublicCreatorType> {
    const viewerId = context.user?.userId;

    const [
      followerCount,
      followingCount,
      totalNftsCreated,
      totalSalesVolume,
      isVerified,
      isFollowing,
    ] = await Promise.all([
      this.followService.followerCount(user.id),
      this.followService.followingCount(user.id),
      this.usersService.countNftsCreated(user.id),
      this.usersService.getCreatorSalesVolume(user.id),
      this.usersService.isVerifiedCreator(user.id),
      viewerId
        ? this.followService.isFollowing(viewerId, user.id)
        : Promise.resolve(null),
    ]);

    return {
      id: user.id,
      username: user.username ?? null,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      bannerUrl: user.bannerUrl ?? null,
      website: user.website ?? null,
      twitterHandle: user.twitterHandle ?? null,
      instagramHandle: user.instagramHandle ?? null,
      isVerified,
      followerCount,
      followingCount,
      totalNftsCreated,
      totalSalesVolume,
      createdAt: user.createdAt,
      isFollowing,
      nfts: undefined,
      collections: undefined,
      activity: undefined,
      listings: undefined,
      sales: undefined,
    };
  }

  private assertValidIdentifier(identifier: string): void {
    const trimmed = identifier.trim();
    if (!trimmed || trimmed.length > IDENTIFIER_MAX_LENGTH) {
      throw new BadRequestException('Invalid creator identifier');
    }
  }

  private toNftConnection(
    nfts: Nft[],
    totalCount: number,
    hasNextPage: boolean,
  ): NFTConnection {
    const edges = nfts.map((nft) => ({
      node: this.toGraphqlNft(nft),
      cursor: this.encodeNftCursor(nft),
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

  private toCollectionConnection(
    collections: Collection[],
    totalCount: number,
    hasNextPage: boolean,
  ): CollectionConnection {
    const edges = collections.map((collection) => ({
      node: this.toGraphqlCollection(collection),
      cursor: this.encodeCollectionCursor(collection),
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
      contractAddress: collection.contractAddress ?? null,
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

  private encodeNftCursor(nft: Nft): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: nft.createdAt.toISOString(),
        id: nft.id,
        price: nft.lastPrice ?? '0',
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeNftCursor(cursor: string): {
    createdAt: string;
    id: string;
    price?: string;
  } {
    try {
      const payload = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as { createdAt: string; id: string; price?: string };

      if (!payload.createdAt || !payload.id) {
        throw new Error('Invalid cursor');
      }

      return payload;
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }

  private encodeCollectionCursor(
    collection: Pick<Collection, 'createdAt' | 'id'>,
  ): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: collection.createdAt.toISOString(),
        id: collection.id,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCollectionCursor(cursor: string): {
    createdAt: string;
    id: string;
  } {
    try {
      const payload = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as { createdAt: string; id: string };

      if (!payload.createdAt || !payload.id) {
        throw new Error('Invalid cursor');
      }

      return payload;
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }

  private encodeActivityCursor(item: CreatorActivityItem): string {
    return Buffer.from(
      JSON.stringify({
        occurredAt: item.occurredAt.toISOString(),
        type: item.type,
        nftId: item.nftId ?? '',
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeActivityCursor(cursor: string): {
    occurredAt: Date;
    type: CreatorActivityKind;
    nftId?: string;
  } {
    try {
      const payload = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as {
        occurredAt: string;
        type: CreatorActivityKind;
        nftId?: string;
      };

      if (!payload.occurredAt || !payload.type) {
        throw new Error('Invalid cursor');
      }

      return {
        occurredAt: new Date(payload.occurredAt),
        type: payload.type,
        nftId: payload.nftId,
      };
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }
}
