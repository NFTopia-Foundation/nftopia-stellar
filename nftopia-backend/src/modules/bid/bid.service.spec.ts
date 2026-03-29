import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { Keypair } from 'stellar-sdk';

import { BidService } from './bid.service';
import { Bid, BidSorobanStatus } from '../auction/entities/bid.entity';
import { Auction } from '../auction/entities/auction.entity';
import { User } from '../../users/user.entity';
import { AuctionStatus } from '../auction/interfaces/auction.interface';
import { StellarSignatureStrategy } from '../../auth/strategies/stellar.strategy';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BID_PLACED_EVENT, BID_CACHE_PREFIX } from './interfaces/bid.interface';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuction(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 'auction-uuid-1',
    nftContractId: 'CONTRACT_ID',
    nftTokenId: 'TOKEN_1',
    sellerId: 'seller-uuid',
    seller: {} as User,
    startPrice: 10,
    currentPrice: 10,
    reservePrice: undefined,
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(Date.now() + 3_600_000),
    status: AuctionStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Auction;
}

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: 'bid-uuid-1',
    auctionId: 'auction-uuid-1',
    bidderId: 'bidder-uuid',
    amount: 11,
    amountXlm: '11.0000000',
    sorobanStatus: BidSorobanStatus.SKIPPED,
    createdAt: new Date(),
    ...overrides,
  } as Bid;
}

function signBidMessage(
  keypair: Keypair,
  auctionId: string,
  amount: string,
): string {
  const message = `bid:${auctionId}:${amount}`;
  const sig = keypair.sign(Buffer.from(message, 'utf8'));
  return Buffer.from(sig).toString('base64');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BidService', () => {
  let service: BidService;

  const testKeypair = Keypair.random();

  const mockBidRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockAuctionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const cfg: Record<string, string | undefined> = {
        AUCTION_CONTRACT_ID: undefined,
        SOROBAN_RPC_URL: undefined,
        STELLAR_HORIZON_URL: undefined,
      };
      return cfg[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidService,
        StellarSignatureStrategy,
        { provide: getRepositoryToken(Bid), useValue: mockBidRepo },
        { provide: getRepositoryToken(Auction), useValue: mockAuctionRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(BidService);
  });

  // ── placeBid ────────────────────────────────────────────────────────────────

  describe('placeBid', () => {
    const auctionId = 'auction-uuid-1';
    const bidderId = 'bidder-uuid';
    const amount = '15.0000000';

    function makeDto(): PlaceBidDto {
      return {
        amount,
        publicKey: testKeypair.publicKey(),
        signature: signBidMessage(testKeypair, auctionId, amount),
      };
    }

    it('places a bid and emits BID_PLACED_EVENT', async () => {
      const auction = makeAuction();
      const persisted = makeBid({ amount: 15, amountXlm: amount });

      mockCache.get.mockResolvedValue(null); // no rate limit hit
      mockAuctionRepo.findOne.mockResolvedValue(auction);
      mockBidRepo.findOne
        .mockResolvedValueOnce(null) // validate amount: no existing highest
        .mockResolvedValueOnce(null); // no Horizon balance check (STELLAR_HORIZON_URL = undefined)
      mockBidRepo.create.mockReturnValue(persisted);
      mockBidRepo.save.mockResolvedValue(persisted);
      mockAuctionRepo.save.mockResolvedValue(auction);
      mockCache.del.mockResolvedValue(undefined);

      const result = await service.placeBid(auctionId, bidderId, makeDto());

      expect(result.amountXlm).toBe(amount);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BID_PLACED_EVENT,
        expect.objectContaining({ auctionId, amount: 15 }),
      );
    });

    it('throws ForbiddenException when seller bids on own auction', async () => {
      const auction = makeAuction({ sellerId: bidderId });
      mockCache.get.mockResolvedValue(null);
      mockAuctionRepo.findOne.mockResolvedValue(auction);

      await expect(
        service.placeBid(auctionId, bidderId, makeDto()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for expired auction', async () => {
      const auction = makeAuction({
        endTime: new Date(Date.now() - 1000),
      });
      mockCache.get.mockResolvedValue(null);
      mockAuctionRepo.findOne.mockResolvedValue(auction);

      await expect(
        service.placeBid(auctionId, bidderId, makeDto()),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-active auction', async () => {
      const auction = makeAuction({ status: AuctionStatus.COMPLETED });
      mockCache.get.mockResolvedValue(null);
      mockAuctionRepo.findOne.mockResolvedValue(auction);

      await expect(
        service.placeBid(auctionId, bidderId, makeDto()),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException for invalid Stellar signature', async () => {
      const auction = makeAuction();
      mockCache.get.mockResolvedValue(null);
      mockAuctionRepo.findOne.mockResolvedValue(auction);

      const badDto: PlaceBidDto = {
        amount,
        publicKey: testKeypair.publicKey(),
        signature: 'aW52YWxpZHNpZ25hdHVyZQ==', // invalid base64 sig
      };

      await expect(
        service.placeBid(auctionId, bidderId, badDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when bid is below minimum increment', async () => {
      const auction = makeAuction({ currentPrice: 100 });
      const insufficientAmount = '100.01'; // still below 5% threshold
      const dto2: PlaceBidDto = {
        amount: insufficientAmount,
        publicKey: testKeypair.publicKey(),
        signature: signBidMessage(testKeypair, auctionId, insufficientAmount),
      };

      mockCache.get.mockResolvedValue(null);
      mockAuctionRepo.findOne.mockResolvedValue(auction);
      // Highest bid in DB is 100 XLM
      mockBidRepo.findOne.mockResolvedValue(makeBid({ amount: 100 }));

      await expect(service.placeBid(auctionId, bidderId, dto2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws HttpException (429) when rate limit exceeded', async () => {
      // Simulate already at max
      mockCache.get.mockResolvedValue(String(5));

      await expect(
        service.placeBid(auctionId, bidderId, makeDto()),
      ).rejects.toThrow(HttpException);
    });

    it('throws NotFoundException when auction does not exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAuctionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.placeBid(auctionId, bidderId, makeDto()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getHighestBid ────────────────────────────────────────────────────────────

  describe('getHighestBid', () => {
    it('returns cached result if present', async () => {
      const cached = {
        auctionId: 'auction-uuid-1',
        amount: 50,
        amountXlm: '50.0000000',
        bidderId: 'bidder-uuid',
        fromCache: true,
      };
      mockCache.get.mockResolvedValue(cached);

      const result = await service.getHighestBid('auction-uuid-1');
      expect(result.fromCache).toBe(true);
      expect(result.amount).toBe(50);
      expect(mockBidRepo.findOne).not.toHaveBeenCalled();
    });

    it('fetches from DB when cache misses and no contract configured', async () => {
      const auction = makeAuction();
      const bid = makeBid({ amount: 42, amountXlm: '42.0000000' });

      mockCache.get.mockResolvedValue(null); // cache miss
      mockAuctionRepo.findOne.mockResolvedValue(auction);
      mockBidRepo.findOne.mockResolvedValue(bid);

      const result = await service.getHighestBid('auction-uuid-1');
      expect(result.amount).toBe(42);
      expect(result.fromCache).toBe(false);
      expect(mockCache.set).toHaveBeenCalledWith(
        `${BID_CACHE_PREFIX}auction-uuid-1`,
        expect.any(Object),
        expect.any(Number),
      );
    });

    it('throws NotFoundException when no bids exist', async () => {
      const auction = makeAuction();
      mockCache.get.mockResolvedValue(null);
      mockAuctionRepo.findOne.mockResolvedValue(auction);
      mockBidRepo.findOne.mockResolvedValue(null);

      await expect(service.getHighestBid('auction-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getMyBids ────────────────────────────────────────────────────────────────

  describe('getMyBids', () => {
    it('returns bids for the current user', async () => {
      const bids = [makeBid(), makeBid({ id: 'bid-uuid-2' })];
      mockBidRepo.find.mockResolvedValue(bids);

      const result = await service.getMyBids('auction-uuid-1', 'bidder-uuid');
      expect(result).toHaveLength(2);
      expect(mockBidRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { auctionId: 'auction-uuid-1', bidderId: 'bidder-uuid' },
        }),
      );
    });
  });

  // ── getBidsByAuction ─────────────────────────────────────────────────────────

  describe('getBidsByAuction', () => {
    it('returns paginated bids', async () => {
      const auction = makeAuction();
      const bids = Array.from({ length: 3 }, (_, i) =>
        makeBid({ id: `bid-${i}`, amount: 10 + i }),
      );
      mockAuctionRepo.findOne.mockResolvedValue(auction);
      mockBidRepo.count.mockResolvedValue(3);

      const qbMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(bids),
      };
      mockBidRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getBidsByAuction('auction-uuid-1', {
        limit: 20,
      });

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });
  });
});
