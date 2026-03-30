import {
  Args,
  Context,
  ID,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import type { GraphqlContext } from '../context/context.interface';
import { ListingService } from '../../modules/listing/listing.service';
import type { Listing } from '../../modules/listing/entities/listing.entity';
import { ListingStatus } from '../../modules/listing/interfaces/listing.interface';
import { GraphqlListing, ListingConnection } from '../types/listing.types';
import {
  CreateListingInput,
  ListingFilterInput,
} from '../inputs/listing.inputs';
import { PaginationInput } from '../inputs/nft.inputs';
import { PageInfo } from '../types/nft.types';

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
    description: 'Fetch listings with pagination and optional filters',
  })
  async listings(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('filter', { type: () => ListingFilterInput, nullable: true })
    filter?: ListingFilterInput,
  ): Promise<ListingConnection> {
    const limit = pagination?.first ?? 20;
    const page = 1;

    const items = await this.listingService.findAll({
      status: filter?.status,
      sellerId: filter?.sellerId,
      nftContractId: filter?.nftContractId,
      nftTokenId: filter?.nftTokenId,
      page,
      limit,
    });

    return this.toConnection(items, items.length, false);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlListing, {
    name: 'createListing',
    description: 'Create a new NFT listing',
  })
  async createListing(
    @Args('input', { type: () => CreateListingInput }) input: CreateListingInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlListing> {
    const callerId = this.getAuthenticatedUserId(context);
    const listing = await this.listingService.create(
      {
        nftContractId: input.nftContractId,
        nftTokenId: input.nftTokenId,
        price: input.price,
        currency: input.currency,
        expiresAt: input.expiresAt,
      },
      callerId,
    );
    return this.toGraphqlListing(listing);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlListing, {
    name: 'cancelListing',
    description: 'Cancel an active listing',
  })
  async cancelListing(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlListing> {
    const callerId = this.getAuthenticatedUserId(context);
    const listing = await this.listingService.cancel(id, callerId);
    return this.toGraphqlListing(listing);
  }

  private getAuthenticatedUserId(context: GraphqlContext): string {
    const userId = context.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }
    return userId;
  }

  private toConnection(
    items: Listing[],
    totalCount: number,
    hasNextPage: boolean,
  ): ListingConnection {
    const edges = items.map((l) => ({
      node: this.toGraphqlListing(l),
      cursor: Buffer.from(l.createdAt.toISOString() + ':' + l.id, 'utf8').toString('base64url'),
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

  private toGraphqlListing(listing: Listing): GraphqlListing {
    return {
      id: listing.id,
      nftContractId: listing.nftContractId,
      nftTokenId: listing.nftTokenId,
      sellerId: listing.sellerId,
      price: Number(listing.price),
      currency: listing.currency,
      status: listing.status as ListingStatus,
      expiresAt: listing.expiresAt,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }
}
