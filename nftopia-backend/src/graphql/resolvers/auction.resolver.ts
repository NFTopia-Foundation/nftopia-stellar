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
import {
  GraphqlAuction,
  GraphqlBid,
  AuctionStatus,
} from '../types/auction.types';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { Bid } from '../../modules/auction/entities/bid.entity';
import type { GraphqlContext } from '../context/context.interface';
import { GraphqlNft } from '../types/nft.types';
import { GraphqlUserType } from '../types/user.types';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import type { User } from '../../users/user.entity';

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

  @ResolveField(() => GraphqlNft, {
    name: 'nft',
    nullable: true,
    description: 'Resolve auction NFT using request-scoped DataLoader',
  })
  async nft(
    @Parent() auction: GraphqlAuction,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlNft | null> {
    const nft = await context.loaders.nftByCompositeKey.load(auction.nftId);
    if (!nft) {
      return null;
    }

    return this.toGraphqlNft(nft);
  }

  @ResolveField(() => GraphqlUserType, {
    name: 'seller',
    nullable: true,
    description: 'Resolve auction seller using request-scoped DataLoader',
  })
  async seller(
    @Parent() auction: GraphqlAuction,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType | null> {
    const seller = await context.loaders.userById.load(auction.sellerId);
    if (!seller) {
      return null;
    }

    return this.toGraphqlUser(seller);
  }

  @ResolveField(() => GraphqlBid, {
    name: 'highestBid',
    nullable: true,
    description: 'Resolve highest bid from auction bids',
  })
  async highestBid(
    @Parent() auction: GraphqlAuction,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlBid | null> {
    const bids = await context.loaders.bidsByAuctionId.load(auction.id);
    if (!bids.length) {
      return null;
    }

    let top = bids[0];
    let topAmount = Number(top.amount);
    for (const bid of bids.slice(1)) {
      const amount = Number(bid.amount);
      if (amount > topAmount) {
        top = bid;
        topAmount = amount;
      }
    }

    return this.toGraphqlBid(top);
  }

  @ResolveField(() => GraphqlUserType, {
    name: 'winner',
    nullable: true,
    description: 'Resolve auction winner using request-scoped DataLoader',
  })
  async winner(
    @Parent() auction: GraphqlAuction,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType | null> {
    if (!auction.winnerId) {
      return null;
    }

    const winner = await context.loaders.userById.load(auction.winnerId);
    if (!winner) {
      return null;
    }

    return this.toGraphqlUser(winner);
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
