import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuctionService } from '../../modules/auction/auction.service';
import { BidService } from '../../modules/bid/bid.service';
import { CollectionService } from '../../modules/collection/collection.service';
import { ListingService } from '../../modules/listing/listing.service';
import { NftService } from '../../modules/nft/nft.service';
import { OrderService } from '../../modules/order/order.service';
import { UsersService } from '../../users/users.service';
import { createGraphqlLoaders } from '../loaders';
import { GraphqlAuthMiddleware } from '../middleware/auth.middleware';
import type { GraphqlContext } from './context.interface';

@Injectable()
export class GraphqlContextFactory {
  constructor(
    private readonly authMiddleware: GraphqlAuthMiddleware,
    private readonly usersService: UsersService,
    private readonly nftService: NftService,
    private readonly collectionService: CollectionService,
    private readonly listingService: ListingService,
    private readonly auctionService: AuctionService,
    private readonly bidService: BidService,
    private readonly orderService: OrderService,
  ) {}

  async create(req: Request, res: Response): Promise<GraphqlContext> {
    const user = await this.authMiddleware.resolveUser(req);
    const loaders = this.createLoaders();

    return {
      req,
      res,
      user,
      loaders,
    };
  }

  /**
   * Context for a GraphQL-WS subscription connection, which has no
   * underlying HTTP request/response — only the `connectionParams` the
   * client sent when opening the socket. Mirrors `create()`'s auth
   * resolution, reading the token from `connectionParams.authorization`
   * instead of a request header.
   */
  async createForSubscription(
    connectionParams: Record<string, unknown> | undefined,
  ): Promise<GraphqlContext> {
    const rawAuthorization = connectionParams?.authorization;
    const token =
      typeof rawAuthorization === 'string'
        ? rawAuthorization.replace(/^Bearer\s+/i, '').trim()
        : undefined;

    const user = await this.authMiddleware.resolveUserFromToken(token);
    const loaders = this.createLoaders();

    return {
      user,
      loaders,
    };
  }

  private createLoaders() {
    return createGraphqlLoaders({
      usersService: this.usersService,
      nftService: this.nftService,
      collectionService: this.collectionService,
      listingService: this.listingService,
      auctionService: this.auctionService,
      bidService: this.bidService,
      orderService: this.orderService,
    });
  }
}
