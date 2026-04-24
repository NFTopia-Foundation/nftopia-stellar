import {
  Args,
  Context,
  ID,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import {
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import type { GraphqlContext } from '../context/context.interface';
import { PaginationInput } from '../inputs/nft.inputs';
import { CreateAuctionInput, PlaceBidInput } from '../inputs/auction.inputs';
import {
  AuctionConnection,
  AuctionStatus,
  GraphqlAuction,
  GraphqlBid,
  TransactionResult,
} from '../types/auction.types';
import { AuctionService } from '../../modules/auction/auction.service';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { Bid } from '../../modules/auction/entities/bid.entity';

type CursorPayload = {
  createdAt: string;
  id: string;
};

@Resolver(() => GraphqlAuction)
export class AuctionResolver {
  constructor(private readonly auctionService: AuctionService) {}

  @Query(() => GraphqlAuction, {
    name: 'auction',
    description: 'Fetch single auction by ID',
  })
  async auction(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GraphqlAuction> {
    const auction = await this.auctionService.findOne(id);
    return this.toGraphqlAuction(auction);
  }

  @Query(() => AuctionConnection, {
    name: 'activeAuctions',
    description: 'Fetch active auctions with pagination',
  })
  async activeAuctions(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<AuctionConnection> {
    const first = pagination?.first ?? 20;
    const after = pagination?.after
      ? this.decodeCursor(pagination.after)
      : undefined;

    const auctions = await this.auctionService.findAll({
      status: AuctionStatus.ACTIVE,
      page: after ? undefined : 1,
      limit: first,
    });

    const totalCount = auctions.length;
    const hasNextPage = auctions.length === first;

    return this.toConnection(auctions, totalCount, hasNextPage);
  }

  @Query(() => [GraphqlBid], {
    name: 'auctionBids',
    description: 'Fetch all bids for an auction',
  })
  async auctionBids(
    @Args('auctionId', { type: () => ID }) auctionId: string,
  ): Promise<GraphqlBid[]> {
    const bids = await this.auctionService.getBids(auctionId);
    return bids.map((bid) => this.toGraphqlBid(bid));
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlAuction, {
    name: 'createAuction',
    description: 'Create new auction',
  })
  async createAuction(
    @Args('input', { type: () => CreateAuctionInput })
    input: CreateAuctionInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlAuction> {
    const callerId = this.getAuthenticatedUserId(context);
    const nft = this.parseNftId(input.nftId);

    const auction = await this.auctionService.create(
      {
        nftContractId: nft.contractId,
        nftTokenId: nft.tokenId,
        startPrice: Number(input.startPrice),
        endTime: input.endTime,
        reservePrice: input.reservePrice
          ? Number(input.reservePrice)
          : undefined,
        startTime: input.startTime,
      },
      callerId,
    );

    return this.toGraphqlAuction(auction);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlBid, {
    name: 'placeBid',
    description: 'Place bid on auction',
  })
  async placeBid(
    @Args('auctionId', { type: () => ID }) auctionId: string,
    @Args('input', { type: () => PlaceBidInput }) input: PlaceBidInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlBid> {
    const bidderId = this.getAuthenticatedUserId(context);

    const bid = await this.auctionService.placeBid(auctionId, bidderId, {
      amount: Number(input.amount),
    });

    return this.toGraphqlBid(bid);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, {
    name: 'cancelAuction',
    description: 'Cancel auction',
  })
  async cancelAuction(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<boolean> {
    const callerId = this.getAuthenticatedUserId(context);
    await this.auctionService.cancelAuction(id, callerId);
    return true;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TransactionResult, {
    name: 'settleAuction',
    description: 'Settle auction after completion',
  })
  async settleAuction(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<TransactionResult> {
    const callerId = this.getAuthenticatedUserId(context);
    const result = await this.auctionService.settleAuction(id, callerId);

    return {
      success: Boolean(result.settled),
      listingId: id,
      buyerId: result.winner,
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
    auctions: Auction[],
    totalCount: number,
    hasNextPage: boolean,
  ): AuctionConnection {
    const edges = auctions.map((auction) => ({
      node: this.toGraphqlAuction(auction),
      cursor: this.encodeCursor(auction),
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

  private toGraphqlAuction(auction: Auction): GraphqlAuction {
    return {
      id: auction.id,
      nftId: this.composeNftId(auction.nftContractId, auction.nftTokenId),
      sellerId: auction.sellerId,
      startPrice: this.toDecimalString(auction.startPrice),
      currentPrice: this.toDecimalString(auction.currentPrice),
      startTime: auction.startTime,
      endTime: auction.endTime,
      status: auction.status as AuctionStatus,
      reservePrice: auction.reservePrice
        ? this.toDecimalString(auction.reservePrice)
        : null,
      winnerId: auction.winnerId ?? null,
    };
  }

  private toGraphqlBid(bid: Bid): GraphqlBid {
    return {
      id: bid.id,
      auctionId: bid.auctionId,
      bidderId: bid.bidderId,
      amount: this.toDecimalString(bid.amount),
      createdAt: bid.createdAt,
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

  private encodeCursor(auction: Pick<Auction, 'createdAt' | 'id'>): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: auction.createdAt.toISOString(),
        id: auction.id,
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
