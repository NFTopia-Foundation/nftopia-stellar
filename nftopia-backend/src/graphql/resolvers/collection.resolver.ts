import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CollectionService } from '../../modules/collection/collection.service';
import type { Collection } from '../../modules/collection/entities/collection.entity';
import { NftService } from '../../modules/nft/nft.service';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import type { GraphqlContext } from '../context/context.interface';
import { NFTFilterInput, PaginationInput } from '../inputs/nft.inputs';
import {
  CollectionFilterInput,
  CreateCollectionInput,
} from '../inputs/collection.inputs';
import {
  CollectionConnection,
  CollectionStats,
  GraphqlCollection,
} from '../types/collection.types';
import { GraphqlNft, NFTConnection } from '../types/nft.types';
import type { CollectionCursorPayload } from '../../modules/collection/interfaces/collection.interface';

@Resolver(() => GraphqlCollection)
export class CollectionResolver {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly nftService: NftService,
  ) {}

  @Query(() => GraphqlCollection, {
    name: 'collection',
    description: 'Fetch a single collection by ID',
  })
  async collection(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GraphqlCollection> {
    const collection = await this.collectionService.findById(id);
    return this.toGraphqlCollection(collection);
  }

  @Query(() => CollectionConnection, {
    name: 'collections',
    description:
      'Fetch collections with cursor pagination and optional filters',
  })
  async collections(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('filter', { type: () => CollectionFilterInput, nullable: true })
    filter?: CollectionFilterInput,
  ): Promise<CollectionConnection> {
    const first = pagination?.first ?? 20;
    const after = pagination?.after
      ? this.decodeCursor(pagination.after)
      : undefined;

    const result = await this.collectionService.findConnection({
      first,
      after,
      creatorId: filter?.creatorId,
      search: filter?.search,
      verifiedOnly: filter?.verifiedOnly,
    });

    return this.toConnection(result.data, result.total, result.hasNextPage);
  }

  @Query(() => [GraphqlCollection], {
    name: 'topCollections',
    description: 'Fetch top collections ordered by total volume',
  })
  async topCollections(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 })
    limit = 10,
  ): Promise<GraphqlCollection[]> {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }

    const collections = await this.collectionService.findTopCollections(limit);
    return collections.map((collection) =>
      this.toGraphqlCollection(collection),
    );
  }

  @Query(() => CollectionStats, {
    name: 'collectionStats',
    description: 'Fetch aggregated statistics for a collection',
  })
  async collectionStats(
    @Args('collectionId', { type: () => ID }) collectionId: string,
  ): Promise<CollectionStats> {
    return this.collectionService.getStats(collectionId);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlCollection, {
    name: 'createCollection',
    description: 'Create a new collection',
  })
  async createCollection(
    @Args('input', { type: () => CreateCollectionInput })
    input: CreateCollectionInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlCollection> {
    const callerId = this.getAuthenticatedUserId(context);
    const collection = await this.collectionService.create(
      {
        contractAddress: input.contractAddress,
        name: input.name,
        symbol: input.symbol,
        description: input.description,
        imageUrl: input.image,
        bannerImageUrl: input.bannerImage,
      },
      callerId,
    );

    return this.toGraphqlCollection(collection);
  }

  @ResolveField(() => NFTConnection, {
    name: 'nfts',
    description: 'Fetch NFTs belonging to a collection',
  })
  async nfts(
    @Parent() collection: GraphqlCollection,
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
      collectionId: collection.id,
      search: filter?.search,
      includeBurned: filter?.includeBurned,
    });

    return this.toNftConnection(result.data, result.total, result.hasNextPage);
  }

  private getAuthenticatedUserId(context: GraphqlContext): string {
    const userId = context.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }

    return userId;
  }

  private toConnection(
    collections: Collection[],
    totalCount: number,
    hasNextPage: boolean,
  ): CollectionConnection {
    const edges = collections.map((collection) => ({
      node: this.toGraphqlCollection(collection),
      cursor: this.encodeCursor(collection),
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

  private toNftConnection(
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

  private encodeCursor(
    collection:
      | Pick<Collection, 'createdAt' | 'id'>
      | Pick<Nft, 'createdAt' | 'id'>,
  ): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: collection.createdAt.toISOString(),
        id: collection.id,
      } satisfies CollectionCursorPayload),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): CollectionCursorPayload {
    try {
      const payload = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as Partial<CollectionCursorPayload>;

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
