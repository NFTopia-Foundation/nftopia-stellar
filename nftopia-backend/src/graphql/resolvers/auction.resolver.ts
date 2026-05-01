import {
  Args,
  Context,
  ID,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AuctionService } from '../../modules/auction/auction.service';
import { GraphqlAuction, GraphqlBid, AuctionStatus } from '../types/auction.types';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { Bid } from '../../modules/auction/entities/bid.entity';
import type { GraphqlContext } from '../context/context.interface';

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

  @ResolveField(() => [GraphqlBid], {
    name: 'bids',
    description: 'Resolve auction bids using request-scoped DataLoader',
  })
  async bids(
    @Parent() auction: GraphqlAuction,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlBid[]> {
    const bids = await context.loaders.bidsByAuctionId.load(auction.id);
    return bids.map((bid) => this.toGraphqlBid(bid));
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

  private toGraphqlBid(bid: Bid): GraphqlBid {
    return {
      id: bid.id,
      auctionId: bid.auctionId,
      bidderId: bid.bidderId,
      amount: this.toDecimalString(bid.amount),
      createdAt: bid.createdAt,
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
}
