import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuctionResolver } from './auction.resolver';
import { AuctionService } from '../../modules/auction/auction.service';
import { AuctionStatus } from '../../modules/auction/interfaces/auction.interface';

const mockAuctionService = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  getBids: jest.fn(),
  create: jest.fn(),
  placeBid: jest.fn(),
  cancelAuction: jest.fn(),
  settleAuction: jest.fn(),
};

const CONTRACT_ID = 'C'.repeat(56);
const NOW = new Date('2026-04-24T08:00:00.000Z');

const mockAuction = {
  id: 'auction-1',
  nftContractId: CONTRACT_ID,
  nftTokenId: 'token-1',
  sellerId: 'seller-1',
  startPrice: 10,
  currentPrice: 15,
  reservePrice: 20,
  startTime: NOW,
  endTime: new Date('2026-04-25T08:00:00.000Z'),
  status: AuctionStatus.ACTIVE,
  winnerId: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const mockBid = {
  id: 'bid-1',
  auctionId: 'auction-1',
  bidderId: 'bidder-1',
  amount: 15,
  createdAt: NOW,
};

const authContext = {
  req: {} as never,
  res: {} as never,
  user: { userId: 'seller-1' },
};

describe('AuctionResolver', () => {
  let resolver: AuctionResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionResolver,
        { provide: AuctionService, useValue: mockAuctionService },
      ],
    }).compile();

    resolver = module.get<AuctionResolver>(AuctionResolver);
    jest.clearAllMocks();
  });

  describe('auction query', () => {
    it('returns a single auction mapped to GraphQL shape', async () => {
      mockAuctionService.findOne.mockResolvedValue(mockAuction);

      const result = await resolver.auction('auction-1');

      expect(mockAuctionService.findOne).toHaveBeenCalledWith('auction-1');
      expect(result.id).toBe('auction-1');
      expect(result.nftId).toBe(`${CONTRACT_ID}:token-1`);
      expect(result.startPrice).toBe('10.0000000');
      expect(result.currentPrice).toBe('15.0000000');
      expect(result.status).toBe(AuctionStatus.ACTIVE);
    });
  });

  describe('activeAuctions query', () => {
    it('returns auction connection with pagination defaults', async () => {
      mockAuctionService.findAll.mockResolvedValue([mockAuction]);

      const result = await resolver.activeAuctions();

      expect(mockAuctionService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuctionStatus.ACTIVE, limit: 20 }),
      );
      expect(result.totalCount).toBe(1);
      expect(result.edges[0]?.node.id).toBe('auction-1');
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('respects pagination first parameter', async () => {
      mockAuctionService.findAll.mockResolvedValue([]);

      await resolver.activeAuctions({ first: 5 });

      expect(mockAuctionService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 }),
      );
    });
  });

  describe('auctionBids query', () => {
    it('returns bids mapped to GraphQL shape', async () => {
      mockAuctionService.getBids.mockResolvedValue([mockBid]);

      const result = await resolver.auctionBids('auction-1');

      expect(mockAuctionService.getBids).toHaveBeenCalledWith('auction-1');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('bid-1');
      expect(result[0]?.amount).toBe('15.0000000');
    });
  });

  describe('createAuction mutation', () => {
    it('creates auction for authenticated user', async () => {
      mockAuctionService.create.mockResolvedValue(mockAuction);

      const result = await resolver.createAuction(
        {
          nftId: `${CONTRACT_ID}:token-1`,
          startPrice: '10',
          endTime: '2026-04-25T08:00:00.000Z',
          reservePrice: '20',
        },
        authContext,
      );

      expect(mockAuctionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nftContractId: CONTRACT_ID,
          nftTokenId: 'token-1',
          startPrice: 10,
          reservePrice: 20,
        }),
        'seller-1',
      );
      expect(result.id).toBe('auction-1');
    });

    it('throws UnauthorizedException when unauthenticated', async () => {
      await expect(
        resolver.createAuction(
          {
            nftId: `${CONTRACT_ID}:token-1`,
            startPrice: '10',
            endTime: '2026-04-25T08:00:00.000Z',
          },
          { req: {} as never, res: {} as never },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('placeBid mutation', () => {
    it('places bid for authenticated user', async () => {
      mockAuctionService.placeBid.mockResolvedValue(mockBid);

      const result = await resolver.placeBid(
        'auction-1',
        { amount: '15' },
        { ...authContext, user: { userId: 'bidder-1' } },
      );

      expect(mockAuctionService.placeBid).toHaveBeenCalledWith(
        'auction-1',
        'bidder-1',
        { amount: 15 },
      );
      expect(result.id).toBe('bid-1');
      expect(result.amount).toBe('15.0000000');
    });

    it('throws UnauthorizedException when unauthenticated', async () => {
      await expect(
        resolver.placeBid('auction-1', { amount: '15' }, {
          req: {} as never,
          res: {} as never,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('cancelAuction mutation', () => {
    it('cancels auction and returns true', async () => {
      mockAuctionService.cancelAuction.mockResolvedValue({
        ...mockAuction,
        status: AuctionStatus.CANCELLED,
      });

      const result = await resolver.cancelAuction('auction-1', authContext);

      expect(mockAuctionService.cancelAuction).toHaveBeenCalledWith(
        'auction-1',
        'seller-1',
      );
      expect(result).toBe(true);
    });

    it('throws UnauthorizedException when unauthenticated', async () => {
      await expect(
        resolver.cancelAuction('auction-1', {
          req: {} as never,
          res: {} as never,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('settleAuction mutation', () => {
    it('settles auction and returns transaction result', async () => {
      mockAuctionService.settleAuction.mockResolvedValue({
        settled: true,
        winner: 'bidder-1',
        amount: '15',
        onchain: { contractId: 'MOCK', txHash: null },
      });

      const result = await resolver.settleAuction('auction-1', authContext);

      expect(mockAuctionService.settleAuction).toHaveBeenCalledWith(
        'auction-1',
        'seller-1',
      );
      expect(result.success).toBe(true);
      expect(result.listingId).toBe('auction-1');
      expect(result.buyerId).toBe('bidder-1');
    });

    it('returns success false when no bids', async () => {
      mockAuctionService.settleAuction.mockResolvedValue({
        settled: false,
        reason: 'No bids',
      });

      const result = await resolver.settleAuction('auction-1', authContext);

      expect(result.success).toBe(false);
    });

    it('throws UnauthorizedException when unauthenticated', async () => {
      await expect(
        resolver.settleAuction('auction-1', {
          req: {} as never,
          res: {} as never,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
