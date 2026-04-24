import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import type { GraphqlContext } from '../context/context.interface';
import { PaginationInput } from '../inputs/nft.inputs';
import {
  CreateListingInput,
  ListingFilterInput,
} from '../inputs/listing.inputs';
import {
  GraphqlListing,
  ListingConnection,
  TransactionResult,
} from '../types/listing.types';
import { ListingService } from '../../modules/listing/listing.service';
import type { Listing } from '../../modules/listing/entities/listing.entity';
import { ListingStatus } from '../../modules/listing/interfaces/listing.interface';

type CursorPayload = {
  createdAt: string;
  id: string;
};

@Resolver(() => GraphqlListing)
export class ListingResolver {
  constructor(private readonly listingService: ListingService) {}

  @Query(() => GraphqlListing, {
    name: 'listing',
    description: 'Fetch a single listing by ID',
  })
  async listing(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GraphqlListing> {
    const listing = await this.listingService.findOne(id);
    return this.toGraphqlListing(listing);
  }

  @Query(() => ListingConnection, {
    name: 'listings',
    description: 'Fetch listings with cursor pagination and optional filters',
  })
  async listings(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('filter', { type: () => ListingFilterInput, nullable: true })
    filter?: ListingFilterInput,
  ): Promise<ListingConnection> {
    const first = pagination?.first ?? 20;
    const after = pagination?.after
      ? this.decodeCursor(pagination.after)
      : undefined;

    const nftParts = filter?.nftId ? this.parseNftId(filter.nftId) : undefined;

    const result = await this.listingService.findConnection({
      first,
      after,
      status: filter?.status,
      sellerId: filter?.sellerId,
      nftContractId: nftParts?.contractId,
      nftTokenId: nftParts?.tokenId,
    });

    return this.toConnection(result.data, result.total, result.hasNextPage);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlListing, {
    name: 'createListing',
    description: 'Create a new marketplace listing',
  })
  async createListing(
    @Args('input', { type: () => CreateListingInput })
    input: CreateListingInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlListing> {
    const callerId = this.getAuthenticatedUserId(context);
    const nft = this.parseNftId(input.nftId);

    const listing = await this.listingService.create(
      {
        nftContractId: nft.contractId,
        nftTokenId: nft.tokenId,
        price: input.price,
        currency: input.currency,
        expiresAt: input.expiresAt,
      },
      callerId,
    );

    return this.toGraphqlListing(listing);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, {
    name: 'cancelListing',
    description: 'Cancel an existing listing owned by the caller',
  })
  async cancelListing(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<boolean> {
    const callerId = this.getAuthenticatedUserId(context);
    await this.listingService.cancel(id, callerId);
    return true;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TransactionResult, {
    name: 'buyNFT',
    description: 'Execute NFT purchase against an active listing',
  })
  async buyNFT(
    @Args('listingId', { type: () => ID }) listingId: string,
    @Context() context: GraphqlContext,
  ): Promise<TransactionResult> {
    const buyerId = this.getAuthenticatedUserId(context);
    const result = await this.listingService.buy(listingId, buyerId);

    return {
      success: Boolean(result.success),
      listingId: result.listingId,
      buyerId: result.buyer,
    };
  }

  private getAuthenticatedUserId(context: GraphqlContext): string {
    const userId = context.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }

    return userId;
  }

  private toConnection(
    listings: Listing[],
    totalCount: number,
    hasNextPage: boolean,
  ): ListingConnection {
    const edges = listings.map((listing) => ({
      node: this.toGraphqlListing(listing),
      cursor: this.encodeCursor(listing),
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

  private toGraphqlListing(listing: Listing): GraphqlListing {
    return {
      id: listing.id,
      nftId: this.composeNftId(listing.nftContractId, listing.nftTokenId),
      sellerId: listing.sellerId,
      price: this.toDecimalString(listing.price),
      currency: listing.currency,
      status: listing.status as ListingStatus,
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt ?? null,
    };
  }

  private parseNftId(nftId: string): { contractId: string; tokenId: string } {
    const [contractId, tokenId] = nftId.split(':');

    if (!contractId || !tokenId) {
      throw new BadRequestException(
        'nftId must be in format <contractId>:<tokenId>',
      );
    }

    return { contractId, tokenId };
  }

  private composeNftId(contractId: string, tokenId: string): string {
    return `${contractId}:${tokenId}`;
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

  private encodeCursor(listing: Pick<Listing, 'createdAt' | 'id'>): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: listing.createdAt.toISOString(),
        id: listing.id,
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
