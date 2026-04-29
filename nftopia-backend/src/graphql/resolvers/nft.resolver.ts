import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  BadRequestException,
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
  async nft(@Args('id', { type: () => ID }) id: string): Promise<GraphqlNft> {
    const nft = await this.nftService.findById(id);
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
