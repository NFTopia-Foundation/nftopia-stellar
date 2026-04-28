import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StellarSignatureGuard } from '../../auth/stellar-signature.guard';
import { BidController } from './bid.controller';
import { BidService } from './bid.service';
import { Bid, BidSorobanStatus } from '../auction/entities/bid.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidQueryDto } from './dto/bid-query.dto';
import type { Request as ExpressRequest } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: 'bid-uuid-1',
    auctionId: 'auction-uuid-1',
    bidderId: 'bidder-uuid',
    amount: 15,
    amountXlm: '15.0000000',
    sorobanStatus: BidSorobanStatus.SKIPPED,
    createdAt: new Date(),
    ...overrides,
  } as Bid;
}

function makeAuthRequest(userId = 'bidder-uuid') {
  return { user: { userId } } as ExpressRequest & {
    user?: { userId?: string };
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BidController', () => {
  let controller: BidController;

  const mockBidService = {
    placeBid: jest.fn(),
    getBidsByAuction: jest.fn(),
    getHighestBid: jest.fn(),
    getMyBids: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BidController],
      providers: [{ provide: BidService, useValue: mockBidService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(StellarSignatureGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(BidController);
  });

  // ── POST /bids/:auctionId ───────────────────────────────────────────────────

  describe('placeBid', () => {
    const dto: PlaceBidDto = {
      amount: '15.0000000',
      publicKey: 'GBYYY...', // shortened for test
      signature: 'dGVzdA==',
    };

    it('delegates to BidService.placeBid and returns bid', async () => {
      const bid = makeBid();
      mockBidService.placeBid.mockResolvedValue(bid);

      const result = await controller.placeBid(
        'auction-uuid-1',
        dto,
        makeAuthRequest(),
      );

      expect(result).toEqual(bid);
      expect(mockBidService.placeBid).toHaveBeenCalledWith(
        'auction-uuid-1',
        'bidder-uuid',
        dto,
      );
    });

    it('forwards ForbiddenException from service', async () => {
      mockBidService.placeBid.mockRejectedValue(
        new ForbiddenException('Sellers cannot bid on their own auctions'),
      );

      await expect(
        controller.placeBid('auction-uuid-1', dto, makeAuthRequest()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forwards BadRequestException from service', async () => {
      mockBidService.placeBid.mockRejectedValue(
        new BadRequestException('Auction has expired'),
      );

      await expect(
        controller.placeBid('auction-uuid-1', dto, makeAuthRequest()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── GET /bids/auction/:auctionId ────────────────────────────────────────────

  describe('getAuctionBids', () => {
    it('returns paginated bids from service', async () => {
      const payload = {
        data: [makeBid(), makeBid({ id: 'bid-uuid-2', amount: 20 })],
        total: 2,
      };
      mockBidService.getBidsByAuction.mockResolvedValue(payload);

      const query: BidQueryDto = { limit: 10 };
      const result = await controller.getAuctionBids('auction-uuid-1', query);

      expect(result).toEqual(payload);
      expect(mockBidService.getBidsByAuction).toHaveBeenCalledWith(
        'auction-uuid-1',
        query,
      );
    });
  });

  // ── GET /bids/highest/:auctionId ────────────────────────────────────────────

  describe('getHighestBid', () => {
    it('returns highest bid from service', async () => {
      const highest = {
        auctionId: 'auction-uuid-1',
        amount: 50,
        amountXlm: '50.0000000',
        bidderId: 'bidder-uuid',
        fromCache: true,
      };
      mockBidService.getHighestBid.mockResolvedValue(highest);

      const result = await controller.getHighestBid('auction-uuid-1');
      expect(result).toEqual(highest);
    });

    it('forwards NotFoundException when no bids', async () => {
      mockBidService.getHighestBid.mockRejectedValue(
        new NotFoundException('No bids found'),
      );

      await expect(controller.getHighestBid('auction-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── GET /bids/my/:auctionId ─────────────────────────────────────────────────

  describe('getMyBids', () => {
    it('returns own bids scoped to authenticated user', async () => {
      const bids = [makeBid()];
      mockBidService.getMyBids.mockResolvedValue(bids);

      const result = await controller.getMyBids(
        'auction-uuid-1',
        makeAuthRequest(),
      );

      expect(result).toEqual(bids);
      expect(mockBidService.getMyBids).toHaveBeenCalledWith(
        'auction-uuid-1',
        'bidder-uuid',
      );
    });
  });
});
