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
import { AuctionService } from '../../modules/auction/auction.service';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import { AuctionStatus } from '../../modules/auction/interfaces/auction.interface';
import { GraphqlAuction, AuctionConnection } from '../types/auction.types';
import {
  AuctionFilterInput,
  CreateAuctionInput,
  PlaceBidInput,
} from '../inputs/auction.inputs';
import { PaginationInput } from '../inputs/nft.inputs';
import { PageInfo } from '../types/nft.types';

@Resolver(() => GraphqlAuction)
export class AuctionResolver {
  constructor(private readonly auctionService: AuctionService) {}

  @Query(() => GraphqlAuction, {
    name: 'auction',
    description: 'Fetch a single auction by ID',
  })
  async auction(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GraphqlAuction> {
    const auction = await this.auctionService.findOne(id);
    return this.toGraphqlAuction(auction);
  }

  @Query(() => AuctionConnection, {
    name: 'auctions',
    description: 'Fetch auctions with pagination and optional filters',
  })
  async auctions(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('filter', { type: () => AuctionFilterInput, nullable: true })
    filter?: AuctionFilterInput,
  ): Promise<AuctionConnection> {
    const limit = pagination?.first ?? 20;

    const items = await this.auctionService.findAll({
      status: filter?.status,
      sellerId: filter?.sellerId,
      nftContractId: filter?.nftContractId,
      nftTokenId: filter?.nftTokenId,
      page: 1,
      limit,
    });

    return this.toConnection(items, items.length, false);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlAuction, {
    name: 'createAuction',
    description: 'Create a new NFT auction',
  })
  async createAuction(
    @Args('input', { type: () => CreateAuctionInput }) input: CreateAuctionInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlAuction> {
    const callerId = this.getAuthenticatedUserId(context);
    const auction = await this.auctionService.create(
      {
        nftContractId: input.nftContractId,
        nftTokenId: input.nftTokenId,
        startPrice: input.startPrice,
        reservePrice: input.reservePrice,
        startTime: input.startTime,
        endTime: input.endTime,
      },
      callerId,
    );
    return this.toGraphqlAuction(auction);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlAuction, {
    name: 'cancelAuction',
    description: 'Cancel an active auction',
  })
  async cancelAuction(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlAuction> {
    const callerId = this.getAuthenticatedUserId(context);
    const auction = await this.auctionService.cancelAuction(id, callerId);
    return this.toGraphqlAuction(auction);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlAuction, {
    name: 'placeBid',
    description: 'Place a bid on an active auction',
  })
  async placeBid(
    @Args('auctionId', { type: () => ID }) auctionId: string,
    @Args('input', { type: () => PlaceBidInput }) input: PlaceBidInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlAuction> {
    const callerId = this.getAuthenticatedUserId(context);
    await this.auctionService.placeBid(auctionId, callerId, {
      amount: input.amount,
    });
    const auction = await this.auctionService.findOne(auctionId);
    return this.toGraphqlAuction(auction);
  }

  private getAuthenticatedUserId(context: GraphqlContext): string {
    const userId = context.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }
    return userId;
  }

  private toConnection(
    items: Auction[],
    totalCount: number,
    hasNextPage: boolean,
  ): AuctionConnection {
    const edges = items.map((a) => ({
      node: this.toGraphqlAuction(a),
      cursor: Buffer.from(a.createdAt.toISOString() + ':' + a.id, 'utf8').toString('base64url'),
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

  private toGraphqlAuction(auction: Auction): GraphqlAuction {
    return {
      id: auction.id,
      nftContractId: auction.nftContractId,
      nftTokenId: auction.nftTokenId,
      sellerId: auction.sellerId,
      startPrice: Number(auction.startPrice),
      currentPrice: Number(auction.currentPrice),
      reservePrice:
        auction.reservePrice != null ? Number(auction.reservePrice) : undefined,
      startTime: auction.startTime,
      endTime: auction.endTime,
      status: auction.status,
      winnerId: auction.winnerId,
      createdAt: auction.createdAt,
      updatedAt: auction.updatedAt,
    };
  }
}
