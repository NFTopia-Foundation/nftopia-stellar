import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { GraphqlContext } from '../context/context.interface';
import {
  GraphqlAuction,
  GraphqlBid,
  AuctionStatus,
} from '../types/auction.types';
import { GraphqlUserType } from '../types/user.types';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { User } from '../../users/user.entity';

@Resolver(() => GraphqlBid)
export class BidResolver {
  @ResolveField(() => GraphqlAuction, {
    name: 'auction',
    nullable: true,
    description: 'Resolve bid auction using request-scoped DataLoader',
  })
  async auction(
    @Parent() bid: GraphqlBid,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlAuction | null> {
    const auction = await context.loaders.auctionById.load(bid.auctionId);
    if (!auction) {
      return null;
    }

    return this.toGraphqlAuction(auction);
  }

  @ResolveField(() => GraphqlUserType, {
    name: 'bidder',
    nullable: true,
    description: 'Resolve bid bidder using request-scoped DataLoader',
  })
  async bidder(
    @Parent() bid: GraphqlBid,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType | null> {
    const bidder = await context.loaders.userById.load(bid.bidderId);
    if (!bidder) {
      return null;
    }

    return this.toGraphqlUser(bidder);
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

  private toGraphqlUser(user: User): GraphqlUserType {
    return {
      id: user.id,
      username: user.username ?? null,
      email: user.email ?? null,
      walletAddress: user.walletAddress ?? user.address ?? null,
      stellarAddress: user.walletAddress ?? user.address ?? null,
      avatar: user.avatarUrl ?? null,
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
