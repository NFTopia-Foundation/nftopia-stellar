import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import {
  BadRequestException,
  Inject,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { PubSub } from 'graphql-subscriptions';
import { AuctionService } from '../../modules/auction/auction.service';
import { BidService } from '../../modules/bid/bid.service';
import { PUB_SUB } from '../pubsub/pubsub.provider';
import { AUCTION_BID_PLACED_TOPIC } from '../pubsub/topics';
import type { AuctionBidPlacedPayload } from '../pubsub/auction-bid.publisher';

/**
 * Scopes `auctionBidPlaced` per auction (#650) — not a global firehose.
 * Exported standalone (rather than inlined in the decorator) so it has its
 * own direct test coverage; see docs/graphql-subscriptions.md.
 */
export function auctionBidPlacedFilter(
  payload: AuctionBidPlacedPayload,
  variables: { auctionId: string },
): boolean {
  return payload.auctionBidPlaced.auctionId === variables.auctionId;
}

import {
  GraphqlAuction,
  GraphqlBid,
  AuctionConnection,
  AuctionTransactionResult,
} from '../types/auction.types';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { Bid } from '../../modules/auction/entities/bid.entity';
import type { GraphqlContext } from '../context/context.interface';
import { GraphqlNft } from '../types/nft.types';
import { GraphqlUserType } from '../types/user.types';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import type { User } from '../../users/user.entity';
import {
  CreateBidInput,
  CreateAuctionInput,
  AuctionPaginationInput,
} from '../inputs/auction.inputs';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { AuctionStatus as AuctionStatusEnum } from '../../modules/auction/interfaces/auction.interface';
import {
  DATALOADER_LIST_RELATION_COMPLEXITY,
  DATALOADER_RELATION_COMPLEXITY,
  paginatedComplexity,
} from '../complexity';

@Resolver(() => GraphqlAuction)
export class AuctionResolver {
  constructor(
    private readonly auctionService: AuctionService,
    private readonly bidService: BidService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  // === QUERIES ===

  @Query(() => GraphqlAuction, {
    name: 'auction',
    description: 'Fetch a single auction by ID',
  })
  async auction(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GraphqlAuction> {
    const auction = await this.auctionService.findOne(id);
    if (!auction) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }
    return this.toGraphqlAuction(auction);
  }

  @Query(() => AuctionConnection, {
    name: 'activeAuctions',
    description: 'Fetch active (non-expired) auctions with pagination',
    complexity: paginatedComplexity(),
  })
  async activeAuctions(
    @Args('pagination', { type: () => AuctionPaginationInput, nullable: true })
    pagination?: AuctionPaginationInput,
  ): Promise<AuctionConnection> {
    const first = pagination?.first ?? 20;
    // `after` is reserved for future cursor-based pagination implementation
    // const _after = pagination?.after;

    // Use existing findAll method with status filter
    const result = await this.auctionService.findAll({
      status: AuctionStatusEnum.ACTIVE,
      page: 1,
      limit: first,
    });

    // Extract data and determine if there's a next page
    const data = result || [];
    const hasNextPage = data.length > first;
    const displayData = data.slice(0, first);

    return this.toConnection(displayData, data.length, hasNextPage);
  }

  @Query(() => [GraphqlBid], {
    name: 'auctionBids',
    description: 'Fetch bids for an auction (newest first, capped page size)',
    complexity: DATALOADER_LIST_RELATION_COMPLEXITY,
  })
  async auctionBids(
    @Args('auctionId', { type: () => ID }) auctionId: string,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
  ): Promise<GraphqlBid[]> {
    const bids = await this.auctionService.getBids(auctionId);
    const startIndex = cursor
      ? Math.max(bids.findIndex((bid) => bid.id === cursor) + 1, 0)
      : 0;
    const pageSize = limit ?? 20;
    const page = bids.slice(startIndex, startIndex + pageSize);
    return page.map((bid) => this.toGraphqlBid(bid));
  }

  // === SUBSCRIPTIONS ===

  @Subscription(() => GraphqlBid, {
    name: 'auctionBidPlaced',
    description: 'Emits when a new bid is placed on the given auction',
    filter: auctionBidPlacedFilter,
  })
  auctionBidPlaced(
    @Args('auctionId', { type: () => ID }) auctionId: string,
  ) {
    return this.pubSub.asyncIterator(AUCTION_BID_PLACED_TOPIC);
  }

  // === MAPPING HELPERS ===

  private toGraphqlAuction(auction: Auction): GraphqlAuction {
    return auction as unknown as GraphqlAuction;
  }

  private toGraphqlBid(bid: Bid): GraphqlBid {
    return bid as unknown as GraphqlBid;
  }

  private toConnection(
    items: Auction[],
    totalCount: number,
    hasNextPage: boolean,
  ): AuctionConnection {
    return {
      edges: items.map((node) => ({
        node: this.toGraphqlAuction(node),
        cursor: node.id,
      })),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: false,
        startCursor: items.length ? items[0].id : null,
        endCursor: items.length ? items[items.length - 1].id : null,
      },
      totalCount,
    } as AuctionConnection;
  }
}
