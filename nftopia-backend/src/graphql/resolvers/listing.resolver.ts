import { UseGuards } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ListingService } from '../../marketplace/listing.service';
import {
  CreateListingInput,
  ListingFilterInput,
  PaginationInput,
} from '../inputs/listing.inputs';
import { GqlJwtAuthGuard } from '../guards/gql-jwt-auth.guard';
import {
  ListingConnection,
  ListingEdge,
  ListingGqlType,
  ListingStatus,
  PageInfo,
  TransactionResult,
} from '../types/listing.types';
import { ListingStatus as ListingStatusEntity } from '../../marketplace/entities/listing.entity';
import { UnauthorizedException } from '@nestjs/common';

interface JwtUser {
  userId?: string;
  sub?: string;
}

@Resolver(() => ListingGqlType)
export class ListingResolver {
  constructor(private readonly listingService: ListingService) {}

  @Query(() => ListingGqlType, { nullable: true })
  async listing(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ListingGqlType | null> {
    const listing = await this.listingService.findById(id);
    return listing ? this.toListingGqlType(listing) : null;
  }

  @Query(() => ListingConnection)
  async listings(
    @Args('filter', { nullable: true }) filter?: ListingFilterInput,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<ListingConnection> {
    const result = await this.listingService.findListings(
      {
        status: filter?.status as ListingStatusEntity | undefined,
        nftId: filter?.nftId,
        sellerId: filter?.sellerId,
      },
      {
        limit: pagination?.limit,
        offset: pagination?.offset,
      },
    );

    const edges: ListingEdge[] = result.items.map((item) => ({
      cursor: item.id,
      node: this.toListingGqlType(item),
    }));

    const pageInfo: PageInfo = {
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
    };

    return {
      edges,
      pageInfo,
      totalCount: result.totalCount,
    };
  }

  @Mutation(() => ListingGqlType)
  @UseGuards(GqlJwtAuthGuard)
  async createListing(
    @Args('input') input: CreateListingInput,
    @Context('req') req: { user?: JwtUser },
  ): Promise<ListingGqlType> {
    const sellerId = this.extractUserId(req.user);

    const created = await this.listingService.createListing({
      nftId: input.nftId,
      sellerId,
      price: input.price,
      currency: input.currency,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });

    return this.toListingGqlType(created);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlJwtAuthGuard)
  async cancelListing(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: { user?: JwtUser },
  ): Promise<boolean> {
    return this.listingService.cancelListing(id, this.extractUserId(req.user));
  }

  @Mutation(() => TransactionResult)
  @UseGuards(GqlJwtAuthGuard)
  async buyNFT(
    @Args('listingId', { type: () => ID }) listingId: string,
    @Context('req') req: { user?: JwtUser },
  ): Promise<TransactionResult> {
    const result = await this.listingService.buyNft(
      listingId,
      this.extractUserId(req.user),
    );

    return {
      success: result.success,
      txHash: result.txHash,
      message: result.message,
    };
  }

  private extractUserId(user?: JwtUser): string {
    const userId = user?.userId ?? user?.sub;
    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user not found in context',
      );
    }
    return userId;
  }

  private toListingGqlType(
    listing: import('../../marketplace/entities/listing.entity').Listing,
  ): ListingGqlType {
    return {
      id: listing.id,
      nftId: listing.nftId,
      sellerId: listing.sellerId,
      price: listing.price,
      currency: listing.currency,
      status: listing.status as unknown as ListingStatus,
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt,
    };
  }
}
