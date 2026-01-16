import { Test, TestingModule } from '@nestjs/testing';
import { BidsService } from './bids.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bid } from './entities/bid.entity';
import { Auction } from '../auctions/entities/auction.entity';
import { User } from '../users/entities/user.entity';
import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CreateBidDto } from './dto/create-bid.dto';

type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepository = <T>(): MockRepository<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('BidsService', () => {
  let service: BidsService;
  let bidRepository: MockRepository<Bid>;
  let auctionRepository: MockRepository<Auction>;
  let userRepository: MockRepository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidsService,
        {
          provide: getRepositoryToken(Bid),
          useValue: createMockRepository<Bid>(),
        },
        {
          provide: getRepositoryToken(Auction),
          useValue: createMockRepository<Auction>(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository<User>(),
        },
      ],
    }).compile();

    service = module.get<BidsService>(BidsService);
    bidRepository = module.get<MockRepository<Bid>>(getRepositoryToken(Bid));
    auctionRepository = module.get<MockRepository<Auction>>(getRepositoryToken(Auction));
    userRepository = module.get<MockRepository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBid', () => {
    it('should create a bid successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const auctionId = 'auction-123';
      const createBidDto: CreateBidDto = { auctionId, amount: 100 };

      const mockUser = { id: userId };
      const mockAuction = {
        id: auctionId,
        endTime: new Date(Date.now() + 86400000), // 1 day in the future
        startingPrice: 50,
        bids: []
      };

      const mockBid = {
        id: 'bid-123',
        auction: mockAuction,
        bidder: mockUser,
        amount: 100,
        createdAt: new Date(),
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      auctionRepository.findOne.mockResolvedValue(mockAuction);
      bidRepository.findOne.mockResolvedValue(null); // No highest bid yet
      bidRepository.create.mockReturnValue(mockBid);
      bidRepository.save.mockResolvedValue(mockBid);

      // Mock getHighestBid to return null (no existing bids)
      jest.spyOn(service, 'getHighestBid').mockResolvedValue(null);

      // Act
      const result = await service.createBid(createBidDto, userId);

      // Assert
      expect(result).toEqual({
        id: mockBid.id,
        auctionId: mockAuction.id,
        bidderId: mockUser.id,
        amount: mockBid.amount,
        createdAt: mockBid.createdAt,
      });
      expect(bidRepository.create).toHaveBeenCalledWith({
        auction: mockAuction,
        bidder: mockUser,
        amount: createBidDto.amount,
      });
      expect(bidRepository.save).toHaveBeenCalledWith(mockBid);
    });

    it('should throw NotFoundException if auction not found', async () => {
      // Arrange
      const userId = 'user-123';
      const auctionId = 'non-existent';
      const createBidDto: CreateBidDto = { auctionId, amount: 100 };

      auctionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createBid(createBidDto, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      const userId = 'non-existent';
      const auctionId = 'auction-123';
      const createBidDto: CreateBidDto = { auctionId, amount: 100 };

      const mockAuction = { id: auctionId, endTime: new Date(Date.now() + 86400000) };

      auctionRepository.findOne.mockResolvedValue(mockAuction);
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createBid(createBidDto, userId)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if auction has ended', async () => {
      // Arrange
      const userId = 'user-123';
      const auctionId = 'auction-123';
      const createBidDto: CreateBidDto = { auctionId, amount: 100 };

      const mockUser = { id: userId };
      const mockAuction = {
        id: auctionId,
        endTime: new Date(Date.now() - 86400000) // 1 day in the past
      };

      auctionRepository.findOne.mockResolvedValue(mockAuction);
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.createBid(createBidDto, userId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if bid amount is less than highest bid', async () => {
      // Arrange
      const userId = 'user-123';
      const auctionId = 'auction-123';
      const createBidDto: CreateBidDto = { auctionId, amount: 100 };

      const mockUser = { id: userId };
      const mockAuction = {
        id: auctionId,
        endTime: new Date(Date.now() + 86400000),
        bids: []
      };

      const mockHighestBid = {
        id: 'bid-456',
        auction: { id: auctionId },
        bidder: { id: 'another-user' },
        amount: 150,
        createdAt: new Date(),
      };

      auctionRepository.findOne.mockResolvedValue(mockAuction);
      userRepository.findOne.mockResolvedValue(mockUser);

      // Mock getHighestBid to return a bid entity
      jest.spyOn(service, 'getHighestBid').mockResolvedValue(mockHighestBid as Bid);

      // Act & Assert
      await expect(service.createBid(createBidDto, userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBidsByAuction', () => {
    it('should return all bids for an auction', async () => {
      // Arrange
      const auctionId = 'auction-123';
      const mockAuction = { id: auctionId };
      const mockBids = [
        {
          id: 'bid-1',
          auction: { id: auctionId },
          bidder: { id: 'user-1' },
          amount: 100,
          createdAt: new Date(),
        },
        {
          id: 'bid-2',
          auction: { id: auctionId },
          bidder: { id: 'user-2' },
          amount: 150,
          createdAt: new Date(),
        },
      ];

      auctionRepository.findOne.mockResolvedValue(mockAuction);
      bidRepository.find.mockResolvedValue(mockBids);

      // Act
      const result = await service.getBidsByAuction(auctionId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockBids[0].id);
      expect(result[1].id).toBe(mockBids[1].id);
    });

    it('should throw NotFoundException if auction not found', async () => {
      // Arrange
      const auctionId = 'non-existent';
      auctionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getBidsByAuction(auctionId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHighestBid', () => {
    it('should return the highest bid for an auction', async () => {
      // Arrange
      const auctionId = 'auction-123';
      const mockAuction = { id: auctionId };
      const mockHighestBid = {
        id: 'bid-2',
        auction: { id: auctionId },
        bidder: { id: 'user-2' },
        amount: 150,
        createdAt: new Date(),
      };

      auctionRepository.findOne.mockResolvedValue(mockAuction);
      bidRepository.findOne.mockResolvedValue(mockHighestBid);

      // Act
      const result = await service.getHighestBid(auctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result.id).toBe(mockHighestBid.id);
      expect(result.amount).toBe(mockHighestBid.amount);
    });

    it('should return null if no bids exist for an auction', async () => {
      // Arrange
      const auctionId = 'auction-123';
      const mockAuction = { id: auctionId };

      auctionRepository.findOne.mockResolvedValue(mockAuction);
      bidRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getHighestBid(auctionId);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw NotFoundException if auction not found', async () => {
      // Arrange
      const auctionId = 'non-existent';
      auctionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getHighestBid(auctionId)).rejects.toThrow(NotFoundException);
    });
  });
});