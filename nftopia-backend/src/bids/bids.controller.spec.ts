import { Test, TestingModule } from '@nestjs/testing';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { BidResponseDto } from './dto/bid-response.dto';
import { Bid } from './entities/bid.entity';

describe('BidsController', () => {
  let controller: BidsController;
  let service: BidsService;

  beforeEach(async () => {
    const mockBidsService = {
      createBid: jest.fn(),
      getBidsByAuction: jest.fn(),
      getHighestBid: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BidsController],
      providers: [
        {
          provide: BidsService,
          useValue: mockBidsService,
        },
      ],
    }).compile();

    controller = module.get<BidsController>(BidsController);
    service = module.get<BidsService>(BidsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createBid', () => {
    it('should call service.createBid with correct parameters', async () => {
      // Arrange
      const auctionId = 'auction-123';
      const userId = 'user-123';
      const createBidDto: CreateBidDto = { auctionId, amount: 100 };
      const expectedResponse: BidResponseDto = {
        id: 'bid-123',
        auctionId,
        bidderId: userId,
        amount: 100,
        createdAt: new Date(),
      };

      jest.spyOn(service, 'createBid').mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.createBid(
        auctionId,
        createBidDto,
        { user: { id: userId } },
      );

      // Assert
      expect(service.createBid).toHaveBeenCalledWith(createBidDto, userId);
      expect(result).toEqual(expectedResponse);
      expect(createBidDto.auctionId).toBe(auctionId); // Check if DTO auctionId was updated
    });
  });

  describe('getBidsByAuction', () => {
    it('should call service.getBidsByAuction with correct auctionId', async () => {
      // Arrange
      const auctionId = 'auction-123';
      const expectedResponse: BidResponseDto[] = [
        {
          id: 'bid-1',
          auctionId,
          bidderId: 'user-1',
          amount: 100,
          createdAt: new Date(),
        },
        {
          id: 'bid-2',
          auctionId,
          bidderId: 'user-2',
          amount: 150,
          createdAt: new Date(),
        },
      ];

      jest.spyOn(service, 'getBidsByAuction').mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.getBidsByAuction(auctionId);

      // Assert
      expect(service.getBidsByAuction).toHaveBeenCalledWith(auctionId);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getHighestBid', () => {
    it('should call service.getHighestBid with correct auctionId and map the result', async () => {
      // Arrange
      const auctionId = 'auction-123';
      const mockBidEntity: Partial<Bid> = {
        id: 'bid-2',
        auction: { id: auctionId } as any,
        bidder: { id: 'user-2' } as any,
        amount: 150,
        createdAt: new Date(),
      };

      const expectedResponse: BidResponseDto = {
        id: mockBidEntity.id,
        auctionId: mockBidEntity.auction.id,
        bidderId: mockBidEntity.bidder.id,
        amount: mockBidEntity.amount,
        createdAt: mockBidEntity.createdAt,
      };

      // Mock the service to return a Bid entity
      jest.spyOn(service, 'getHighestBid').mockResolvedValue(mockBidEntity as Bid);

      // Act
      const result = await controller.getHighestBid(auctionId);

      // Assert
      expect(service.getHighestBid).toHaveBeenCalledWith(auctionId);
      expect(result).toEqual(expectedResponse);
    });

    it('should return null when no bids exist', async () => {
      // Arrange
      const auctionId = 'auction-123';

      jest.spyOn(service, 'getHighestBid').mockResolvedValue(null);

      // Act
      const result = await controller.getHighestBid(auctionId);

      // Assert
      expect(service.getHighestBid).toHaveBeenCalledWith(auctionId);
      expect(result).toBeNull();
    });
  });
});