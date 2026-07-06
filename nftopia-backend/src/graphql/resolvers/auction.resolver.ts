import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuctionService } from '../../modules/auction/auction.service';
import { BidService } from '../../modules/bid/bid.service';
import {
  GraphqlAuction,
  GraphqlBid,
  AuctionConnection,
  AuctionStatus,
  TransactionResult,
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

@Resolver(() => GraphqlAuction)
export class AuctionResolver {
  constructor(
    private readonly auctionService: AuctionService,
    private readonly bidService: BidService,
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
  })
  async activeAuctions(
    @Args('pagination', { type: () => AuctionPaginationInput, nullable: true })
    pagination?: AuctionPaginationInput,
  ): Promise<AuctionConnection> {
    const first = pagination?.first ?? 20;
    const after = pagination?.after;

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
    description: 'Fetch all bids for an auction',
  })
  async auctionBids(
    @Args('auctionId', { type: () => ID }) auctionId: string,
  ): Promise<GraphqlBid[]> {
    const bids = await this.auctionService.getBids(auctionId);
    return bids.map((bid) => this.toGraphqlBid(bid));
  }

  // === MUTATIONS ===

  /**
   * Create a new auction
   * Requires authentication
   */
  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlAuction, {
    name: 'createAuction',
    description: 'Create a new auction (authenticated)',
  })
  async createAuction(
    @Args('input', { type: () => CreateAuctionInput })
    input: CreateAuctionInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlAuction> {
    const userId = this.getAuthenticatedUserId(context);

    // Validate end time is in the future
    const now = new Date();
    if (input.endTime <= now) {
      throw new BadRequestException('End time must be in the future');
    }

    // Validate start price is positive
    const startPrice = parseFloat(input.startPrice);
    if (isNaN(startPrice) || startPrice <= 0) {
      throw new BadRequestException('Start price must be a positive number');
    }

    // Validate reserve price if provided
    if (input.reservePrice) {
      const reservePrice = parseFloat(input.reservePrice);
      if (isNaN(reservePrice) || reservePrice < startPrice) {
        throw new BadRequestException(
          'Reserve price must be greater than or equal to start price',
        );
      }
    }

    // Create auction using existing service method
    // Extract nftContractId and nftTokenId from nftId (format: "contractId:tokenId")
    const [nftContractId, nftTokenId] = input.nftId.split(':');
    
    const auctionResult = await this.auctionService.create(
      {
        nftContractId: nftContractId || input.nftId,
        nftTokenId: nftTokenId || '0',
        startPrice: startPrice,
        reservePrice: input.reservePrice ? parseFloat(input.reservePrice) : undefined,
        startTime: new Date().toISOString(),
        endTime: input.endTime.toISOString(),
        currency: 'XLM',
      },
      userId
    );

    // Handle both on-chain and legacy responses
    let auction: Auction;
    if ('success' in auctionResult && 'auctionId' in auctionResult) {
      // On-chain auction created, fetch the actual auction
      auction = await this.auctionService.findOne(String(auctionResult.auctionId));
    } else {
      auction = auctionResult as Auction;
    }

    return this.toGraphqlAuction(auction);
  }

  /**
   * Place a bid on an auction
   * Requires authentication
   */
  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlBid, {
    name: 'placeBid',
    description: 'Place a bid on an auction',
  })
  async placeBid(
    @Args('input', { type: () => CreateBidInput }) input: CreateBidInput,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlBid> {
    const userId = this.getAuthenticatedUserId(context);

    // Validate auction exists and is active
    const auction = await this.auctionService.findOne(input.auctionId);
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    if (auction.status !== AuctionStatusEnum.ACTIVE) {
      throw new BadRequestException('Auction is not active');
    }

    // Validate bid amount
    const currentPrice = parseFloat(String(auction.currentPrice));
    const minBid = currentPrice + 0.01;
    if (input.amount < minBid) {
      throw new BadRequestException(`Minimum bid is ${minBid}`);
    }

    // Validate user is not the seller
    if (auction.sellerId === userId) {
      throw new BadRequestException('You cannot bid on your own auction');
    }

    // Create bid using existing service method
    const bid = await this.bidService.create({
      auctionId: input.auctionId,
      bidderId: userId,
      amount: input.amount,
    });

    return this.toGraphqlBid(bid);
  }

  /**
   * Cancel an auction
   * Requires authentication
   */
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, {
    name: 'cancelAuction',
    description: 'Cancel an auction (authenticated)',
  })
  async cancelAuction(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<boolean> {
    const userId = this.getAuthenticatedUserId(context);

    const auction = await this.auctionService.findOne(id);
    if (!auction) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }

    // Only seller can cancel
    if (auction.sellerId !== userId) {
      throw new UnauthorizedException('Only the seller can cancel this auction');
    }

    // Cannot cancel completed or settled auctions
    if (
      auction.status === AuctionStatusEnum.COMPLETED ||
      auction.status === AuctionStatusEnum.SETTLED
    ) {
      throw new BadRequestException(
        'Cannot cancel a completed or settled auction',
      );
    }

    await this.auctionService.cancelAuction(id, userId);
    return true;
  }

  /**
   * Settle an auction after completion
   * Requires authentication
   */
  @UseGuards(GqlAuthGuard)
  @Mutation(() => TransactionResult, {
    name: 'settleAuction',
    description: 'Settle an auction after completion (authenticated)',
  })
  async settleAuction(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<TransactionResult> {
    const userId = this.getAuthenticatedUserId(context);

    const auction = await this.auctionService.findOne(id);
    if (!auction) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }

    // Verify auction is completed or active with expired end time
    if (auction.status !== AuctionStatusEnum.COMPLETED && auction.status !== AuctionStatusEnum.ACTIVE) {
      throw new BadRequestException(
        'Auction must be active or completed before settling',
      );
    }

    // If active, check if end time has passed
    if (auction.status === AuctionStatusEnum.ACTIVE) {
      const now = new Date();
      if (new Date(auction.endTime) > now) {
        throw new BadRequestException(
          'Auction must be completed (end time passed) before settling',
        );
      }
    }

    try {
      const result = await this.auctionService.settleAuction(id, userId);
      
      return {
        success: result.settled || false,
        transactionHash: result.transactionId ? String(result.transactionId) : undefined,
        message: result.settled 
          ? 'Auction settled successfully' 
          : result.reason || 'Auction settlement failed',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to settle auction',
      };
    }
  }

  // === RESOLVE FIELDS ===

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

  // === HELPER METHODS ===

  private getAuthenticatedUserId(context: GraphqlContext): string {
    const userId = context.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }
    return userId;
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
      status: auction.status,
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
        startCursor: edges[0]?.cursor || undefined,
        endCursor: edges.at(-1)?.cursor || undefined,
      },
      totalCount,
    };
  }

  private encodeCursor(auction: Auction): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: auction.createdAt.toISOString(),
        id: auction.id,
      }),
      'utf8',
    ).toString('base64url');
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