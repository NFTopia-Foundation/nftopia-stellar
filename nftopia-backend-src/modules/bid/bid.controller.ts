import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StellarSignatureGuard } from '../../auth/stellar-signature.guard';
import { BidService } from './bid.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidQueryDto } from './dto/bid-query.dto';

type AuthRequest = ExpressRequest & { user?: { userId?: string } };

/**
 * BidController
 *
 * Handles NFT auction bidding endpoints:
 *
 *   POST   /bids/:auctionId           – Place a new bid (JWT + Stellar sig)
 *   GET    /bids/auction/:auctionId   – Get all bids (cursor-based pagination)
 *   GET    /bids/highest/:auctionId   – Get the highest bid (contract + cache)
 *   GET    /bids/my/:auctionId        – Get authenticated user's bids (JWT)
 */
@Controller('bids')
export class BidController {
  constructor(private readonly bidService: BidService) {}

  /**
   * Place a new bid on an active auction.
   * Requires:
   *  - Valid JWT (bidder identity)
   *  - Valid Stellar wallet signature over `bid:{auctionId}:{amount}`
   */
  @UseGuards(JwtAuthGuard, StellarSignatureGuard)
  @Post(':auctionId')
  async placeBid(
    @Param('auctionId', ParseUUIDPipe) auctionId: string,
    @Body() dto: PlaceBidDto,
    @Req() req: AuthRequest,
  ) {
    const bidderId = req.user?.userId as string;
    return this.bidService.placeBid(auctionId, bidderId, dto);
  }

  /**
   * Get all bids for an auction.
   * Supports cursor-based pagination via `ledgerSequence`.
   */
  @Get('auction/:auctionId')
  async getAuctionBids(
    @Param('auctionId', ParseUUIDPipe) auctionId: string,
    @Query() query: BidQueryDto,
  ) {
    return this.bidService.getBidsByAuction(auctionId, query);
  }

  /**
   * Get the highest bid for an auction.
   * Attempts contract query first; falls back to cached DB result.
   */
  @Get('highest/:auctionId')
  async getHighestBid(@Param('auctionId', ParseUUIDPipe) auctionId: string) {
    return this.bidService.getHighestBid(auctionId);
  }

  /**
   * Get the currently authenticated user's bids on a specific auction.
   */
  @UseGuards(JwtAuthGuard)
  @Get('my/:auctionId')
  async getMyBids(
    @Param('auctionId', ParseUUIDPipe) auctionId: string,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.bidService.getMyBids(auctionId, userId);
  }
}
