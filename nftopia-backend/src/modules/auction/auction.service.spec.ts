import { Test, TestingModule } from '@nestjs/testing';
import { AuctionService } from './auction.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { AuctionStatus } from './interfaces/auction.interface';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { User } from '../../users/user.entity';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionState } from '../transaction/enums/transaction-state.enum';
import { NotificationsService } from '../notifications/notifications.service';

const mockAuctionRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((dto: Partial<Auction>) => dto),
  save: jest.fn().mockImplementation((a: Auction) => Promise.resolve(a)),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
};

const mockBidRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((dto: Partial<Bid>) => dto),
  save: jest.fn().mockResolvedValue(undefined),
};

const mockNftRepo = {
  findOne: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
};

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'ENABLE_ONCHAIN_SETTLEMENT') return false;
    return undefined;
  }),
};

const mockSettlementClient = {
  createAuction: jest.fn(),
  placeBid: jest.fn(),
};

const mockTransactionService = {
  createAndExecuteAuctionSettlement: jest.fn(),
};
const mockNotificationsService = {
  broadcastAuctionExtended: jest.fn(),
};

function createFindAllQbMock(result: unknown[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  };
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected promise to reject');
}

describe('AuctionService', () => {
  let service: AuctionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'ENABLE_ONCHAIN_SETTLEMENT') return false;
      return undefined;
    });
    mockTransactionService.createAndExecuteAuctionSettlement.mockResolvedValue({
      id: 'tx-1',
      state: TransactionState.COMPLETED,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        { provide: getRepositoryToken(Auction), useValue: mockAuctionRepo },
        { provide: getRepositoryToken(Bid), useValue: mockBidRepo },
        { provide: getRepositoryToken(StellarNft), useValue: mockNftRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: MarketplaceSettlementClient,
          useValue: mockSettlementClient,
        },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<AuctionService>(AuctionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an auction successfully', async () => {
      mockAuctionRepo.findOne.mockResolvedValueOnce(null);
      mockNftRepo.findOne.mockResolvedValueOnce({
        contractId: 'C',
        tokenId: 'T',
      });

      const dto: CreateAuctionDto = {
        nftContractId: 'C',
        nftTokenId: 'T',
        startPrice: 1,
        endTime: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = await service.create(dto, 'seller-1');
      expect(mockAuctionRepo.create).toHaveBeenCalled();
      expect(mockAuctionRepo.save).toHaveBeenCalled();
      // Type assertion: with ENABLE_ONCHAIN_SETTLEMENT=false, result is Auction
      expect((result as Auction).sellerId).toBe('seller-1');
      expect((result as Auction).status).toBe(AuctionStatus.ACTIVE);
    });

    it('should persist the per-auction minBidIncrement override', async () => {
      mockAuctionRepo.findOne.mockResolvedValueOnce(null);
      mockNftRepo.findOne.mockResolvedValueOnce({
        contractId: 'C',
        tokenId: 'T',
      });

      const dto: CreateAuctionDto = {
        nftContractId: 'C',
        nftTokenId: 'T',
        startPrice: 1,
        minBidIncrement: 2.5,
        endTime: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = await service.create(dto, 'seller-1');
      expect(mockAuctionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ minBidIncrement: 2.5 }),
      );
      expect((result as Auction).minBidIncrement).toBe(2.5);
    });

    it('should prevent duplicate active auction for same NFT', async () => {
      mockAuctionRepo.findOne.mockResolvedValueOnce({ id: 'exists' });

      const dto: CreateAuctionDto = {
        nftContractId: 'C',
        nftTokenId: 'T',
        startPrice: 1,
        endTime: new Date(Date.now() + 86400000).toISOString(),
      };

      const rejection = await captureRejection(service.create(dto, 'seller-1'));

      expect(rejection).toBeInstanceOf(BadRequestException);
      expect(rejection).toHaveProperty(
        'message',
        'NFT already in active auction',
      );
    });

    it('should throw NotFoundException if NFT does not exist', async () => {
      mockAuctionRepo.findOne.mockResolvedValueOnce(null);
      mockNftRepo.findOne.mockResolvedValueOnce(null);

      const dto: CreateAuctionDto = {
        nftContractId: 'C',
        nftTokenId: 'T',
        startPrice: 1,
        endTime: new Date(Date.now() + 86400000).toISOString(),
      };

      await expect(service.create(dto, 'seller-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dto, 'seller-1')).rejects.toThrow(
        'NFT not found',
      );
    });
  });

  describe('findAll', () => {
    it('should return auctions with filters', async () => {
      const mockAuctions = [{ id: 'a1' }, { id: 'a2' }];
      mockAuctionRepo.createQueryBuilder.mockReturnValueOnce(
        createFindAllQbMock(mockAuctions),
      );

      const result = await service.findAll({
        status: AuctionStatus.ACTIVE,
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(mockAuctions);
    });

    it('should return empty array when no auctions match', async () => {
      mockAuctionRepo.createQueryBuilder.mockReturnValueOnce(
        createFindAllQbMock([]),
      );

      const result = await service.findAll({});
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return auction by id', async () => {
      const mockAuction = { id: 'a1', status: AuctionStatus.ACTIVE };
      mockAuctionRepo.findOne.mockResolvedValueOnce(mockAuction);

      const result = await service.findOne('a1');
      expect(result).toEqual(mockAuction);
    });

    it('should throw NotFoundException if auction not found', async () => {
      mockAuctionRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Auction not found',
      );
    });
  });

  describe('getBids', () => {
    it('should return ids for auction', async () => {
      const mockBids = [
        { id: 'b1', amount: 10 },
        { id: 'b2', amount: 20 },
      ];
      mockBidRepo.find.mockResolvedValueOnce(mockBids);

      const result = await service.getBids('a1');
      expect(result).toEqual(mockBids);
      expect(mockBidRepo.find).toHaveBeenCalledWith({
        where: { auctionId: 'a1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('placeBid', () => {
    it('should place a valid bid and update current price', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        endTime: new Date(Date.now() + 10000),
        currentPrice: 1,
        minBidIncrement: 0.5,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      const dto: PlaceBidDto = { amount: 2 } as PlaceBidDto;
      const bid = await service.placeBid('a1', 'b1', dto);

      expect(mockBidRepo.create).toHaveBeenCalledWith({
        auctionId: 'a1',
        bidderId: 'b1',
        amount: 2,
      });
      expect(mockBidRepo.save).toHaveBeenCalled();
      expect(mockAuctionRepo.save).toHaveBeenCalled();
      // Type assertion: with ENABLE_ONCHAIN_SETTLEMENT=false, result is Bid
      expect((bid as Bid).amount).toBe(2);
    });

    it('should accept a bid exactly at the minimum increment boundary', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() + 10000),
        currentPrice: 10,
        minBidIncrement: 2,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      const bid = await service.placeBid('a1', 'b1', {
        amount: 12,
      } as PlaceBidDto);

      expect((bid as Bid).amount).toBe(12);
    });

    it('should reject a bid below the minimum increment with a clear error', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() + 10000),
        currentPrice: 10,
        minBidIncrement: 2,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await expect(
        service.placeBid('a1', 'b1', { amount: 11.99 } as PlaceBidDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.placeBid('a1', 'b1', { amount: 11.99 } as PlaceBidDto),
      ).rejects.toThrow(/minimum increment/i);
      expect(mockBidRepo.save).not.toHaveBeenCalled();
    });

    it('should respect the platform-wide default when no override is set', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_ONCHAIN_SETTLEMENT') return false;
        if (key === 'MIN_BID_INCREMENT_DEFAULT') return '5';
        return undefined;
      });

      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() + 10000),
        currentPrice: 10,
        minBidIncrement: null,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await expect(
        service.placeBid('a1', 'b1', { amount: 14 } as PlaceBidDto),
      ).rejects.toThrow(/minimum increment/i);
    });

    it('should prefer the per-auction override over the platform default', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_ONCHAIN_SETTLEMENT') return false;
        if (key === 'MIN_BID_INCREMENT_DEFAULT') return '10';
        return undefined;
      });

      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() + 10000),
        currentPrice: 10,
        minBidIncrement: 2,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      const bid = await service.placeBid('a1', 'b1', {
        amount: 12,
      } as PlaceBidDto);

      expect((bid as Bid).amount).toBe(12);
    });
  });
});
