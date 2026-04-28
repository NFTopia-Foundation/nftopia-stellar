import { Test, TestingModule } from '@nestjs/testing';
import { AuctionService } from './auction.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { AuctionStatus } from './interfaces/auction.interface';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';

const mockAuctionRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((dto: Partial<Auction>) => dto as unknown as Auction),
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
  create: jest.fn().mockImplementation((dto: Partial<Bid>) => dto as unknown as Bid),
  save: jest.fn().mockResolvedValue(undefined),
};

const mockNftRepo = {
  findOne: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
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

describe('AuctionService', () => {
  let service: AuctionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'ENABLE_ONCHAIN_SETTLEMENT') return false;
      return undefined;
    });
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        { provide: getRepositoryToken(Auction), useValue: mockAuctionRepo },
        { provide: getRepositoryToken(Bid), useValue: mockBidRepo },
        { provide: getRepositoryToken(StellarNft), useValue: mockNftRepo },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MarketplaceSettlementClient, useValue: mockSettlementClient },
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

    it('should prevent duplicate active auction for same NFT', async () => {
      mockAuctionRepo.findOne.mockResolvedValueOnce({ id: 'exists' });
      
      const dto: CreateAuctionDto = {
        nftContractId: 'C',
        nftTokenId: 'T',
        startPrice: 1,
        endTime: new Date(Date.now() + 86400000).toISOString(),
      };

      await expect(service.create(dto, 'seller-1')).rejects.toThrow(
        BadRequestException
      );
      await expect(service.create(dto, 'seller-1')).rejects.toThrow(
        'NFT already in active auction'
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
        NotFoundException
      );
      await expect(service.create(dto, 'seller-1')).rejects.toThrow(
        'NFT not found'
      );
    });
  });

  describe('findAll', () => {
    it('should return auctions with filters', async () => {
      const mockAuctions = [{ id: 'a1' }, { id: 'a2' }];
      mockAuctionRepo.createQueryBuilder.mockReturnValueOnce({
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAuctions),
      } as any);

      const result = await service.findAll({
        status: AuctionStatus.ACTIVE,
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(mockAuctions);
    });

    it('should return empty array when no auctions match', async () => {
      mockAuctionRepo.createQueryBuilder.mockReturnValueOnce({
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

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
        NotFoundException
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Auction not found'
      );
    });
  });

  describe('getBids', () => {
    it('should return bids for auction', async () => {
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
        endTime: new Date(Date.now() + 10000),
        currentPrice: 1,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      const dto: PlaceBidDto = { amount: 2 };
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

    it('should reject bid on non-active auction', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.COMPLETED,
        endTime: new Date(Date.now() + 10000),
        currentPrice: 1,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await expect(
        service.placeBid('a1', 'b1', { amount: 2 })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.placeBid('a1', 'b1', { amount: 2 })
      ).rejects.toThrow('Auction is not active');
    });

    it('should reject bid on expired auction', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() - 1000),
        currentPrice: 1,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await expect(
        service.placeBid('a1', 'b1', { amount: 2 })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.placeBid('a1', 'b1', { amount: 2 })
      ).rejects.toThrow('Auction expired');
    });

    it('should reject bid lower than or equal to current price', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() + 10000),
        currentPrice: 5,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await expect(
        service.placeBid('a1', 'b1', { amount: 3 })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.placeBid('a1', 'b1', { amount: 3 })
      ).rejects.toThrow('Bid must be greater than current price');

      await expect(
        service.placeBid('a1', 'b1', { amount: 5 })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if auction not found', async () => {
      mockAuctionRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.placeBid('nonexistent', 'b1', { amount: 2 })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelAuction', () => {
    it('should cancel auction when seller requests', async () => {
      const auction = {
        id: 'a1',
        sellerId: 's1',
        status: AuctionStatus.ACTIVE,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValue(auction);

      const result = await service.cancelAuction('a1', 's1');
      expect(result.status).toBe(AuctionStatus.CANCELLED);
      expect(mockAuctionRepo.save).toHaveBeenCalled();
    });

    it('should reject cancellation by non-seller', async () => {
      const auction = {
        id: 'a1',
        sellerId: 's1',
        status: AuctionStatus.ACTIVE,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValue(auction);

      await expect(service.cancelAuction('a1', 'other')).rejects.toThrow(
        ForbiddenException
      );
      await expect(service.cancelAuction('a1', 'other')).rejects.toThrow(
        'Only seller can cancel'
      );
    });

    it('should reject cancellation of non-active auction', async () => {
      const auction = {
        id: 'a1',
        sellerId: 's1',
        status: AuctionStatus.COMPLETED,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValue(auction);

      await expect(service.cancelAuction('a1', 's1')).rejects.toThrow(
        BadRequestException
      );
      await expect(service.cancelAuction('a1', 's1')).rejects.toThrow(
        'Auction not active'
      );
    });
  });

  describe('settleAuction', () => {
    it('should settle auction with no bids', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() - 1000),
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
      mockBidRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.settleAuction('a1');
      expect(result.settled).toBe(false);
      expect(result.reason).toBe('No bids');
      expect(mockAuctionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuctionStatus.COMPLETED })
      );
    });

    it('should settle when reserve not met', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        reservePrice: 10,
        endTime: new Date(Date.now() - 1000),
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
      mockBidRepo.findOne.mockResolvedValueOnce({
        bidderId: 'b1',
        amount: 5,
      } as any);

      const result = await service.settleAuction('a1');
      expect(result.settled).toBe(false);
      expect(result.reason).toBe('Reserve not met');
    });

    it('should successfully settle auction with winning bid', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() - 1000),
        nftContractId: 'C',
        nftTokenId: 'T',
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
      mockBidRepo.findOne.mockResolvedValueOnce({
        bidderId: 'b1',
        amount: 20,
        bidder: { address: 'addr1' },
      } as unknown as Bid);
      mockNftRepo.findOne.mockResolvedValueOnce({
        contractId: 'C',
        tokenId: 'T',
        owner: 'old',
      } as unknown as StellarNft);

      const result = await service.settleAuction('a1');
      expect(result.settled).toBe(true);
      expect(result.winner).toBe('b1');
      expect(result.amount).toBe(20);
      expect(mockNftRepo.save).toHaveBeenCalled();
      expect(mockAuctionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AuctionStatus.SETTLED,
          winnerId: 'b1',
        })
      );
    });

    it('should reject settlement of non-active auction', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.COMPLETED,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await expect(service.settleAuction('a1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should allow seller to settle before end time', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 's1',
        endTime: new Date(Date.now() + 10000),
        nftContractId: 'C',
        nftTokenId: 'T',
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
      mockBidRepo.findOne.mockResolvedValueOnce({
        bidderId: 'b1',
        amount: 20,
        bidder: { address: 'addr1' },
      } as unknown as Bid);
      mockNftRepo.findOne.mockResolvedValueOnce({
        contractId: 'C',
        tokenId: 'T',
        owner: 'old',
      } as unknown as StellarNft);

      const result = await service.settleAuction('a1', 's1');
      expect(result.settled).toBe(true);
    });

    it('should reject non-seller settlement before end time', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 's1',
        endTime: new Date(Date.now() + 10000),
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await expect(service.settleAuction('a1', 'other')).rejects.toThrow(
        ForbiddenException
      );
      await expect(service.settleAuction('a1', 'other')).rejects.toThrow(
        'Only seller or admin can settle before end'
      );
    });
  });
});
