import { Test, TestingModule } from '@nestjs/testing';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { AuctionStatus } from './interfaces/auction.interface';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

type ControllerReq = ExpressRequest & { user?: { userId?: string } };

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  getBids: jest.fn(),
  create: jest.fn(),
  placeBid: jest.fn(),
  cancelAuction: jest.fn(),
  settleAuction: jest.fn(),
};

describe('AuctionController', () => {
  let controller: AuctionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuctionController],
      providers: [{ provide: AuctionService, useValue: mockService }],
    }).compile();

    controller = module.get<AuctionController>(AuctionController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should call findAll with query parameters', async () => {
      const mockAuctions = [{ id: 'a1' }, { id: 'a2' }];
      mockService.findAll.mockResolvedValueOnce(mockAuctions);

      const query: AuctionQueryDto = {
        status: AuctionStatus.ACTIVE,
        page: 1,
        limit: 20,
      };

      const result = await controller.list(query);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockAuctions);
    });

    it('should return empty array when no auctions found', async () => {
      mockService.findAll.mockResolvedValueOnce([]);

      const result = await controller.list({});

      expect(result).toEqual([]);
    });
  });

  describe('active', () => {
    it('should call findAll with ACTIVE status', async () => {
      const mockAuctions = [{ id: 'a1', status: AuctionStatus.ACTIVE }];
      mockService.findAll.mockResolvedValueOnce(mockAuctions);

      const query: AuctionQueryDto = { page: 1 };
      const result = await controller.active(query);

      expect(mockService.findAll).toHaveBeenCalledWith({
        ...query,
        status: AuctionStatus.ACTIVE,
      });
      expect(result).toEqual(mockAuctions);
    });
  });

  describe('get', () => {
    it('should return auction by id', async () => {
      const mockAuction = { id: 'a1', status: AuctionStatus.ACTIVE };
      mockService.findOne.mockResolvedValueOnce(mockAuction);

      const result = await controller.get('a1');

      expect(mockService.findOne).toHaveBeenCalledWith('a1');
      expect(result).toEqual(mockAuction);
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockService.findOne.mockRejectedValueOnce(
        new NotFoundException('Auction not found'),
      );

      await expect(controller.get('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bids', () => {
    it('should return bids for auction', async () => {
      const mockBids = [
        { id: 'b1', amount: 10 },
        { id: 'b2', amount: 20 },
      ];
      mockService.getBids.mockResolvedValueOnce(mockBids);

      const result = await controller.bids('a1');

      expect(mockService.getBids).toHaveBeenCalledWith('a1');
      expect(result).toEqual(mockBids);
    });

    it('should return empty array when no bids', async () => {
      mockService.getBids.mockResolvedValueOnce([]);

      const result = await controller.bids('a1');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create auction with seller from request', async () => {
      const dto: CreateAuctionDto = {
        nftContractId: 'C',
        nftTokenId: 'T',
        startPrice: 1,
        endTime: new Date(Date.now() + 86400000).toISOString(),
      };
      const mockReq = { user: { userId: 'seller-1' } };
      const mockAuction = { id: 'a1', sellerId: 'seller-1' };
      mockService.create.mockResolvedValueOnce(mockAuction);

      const result = await controller.create(dto, mockReq as ControllerReq);

      expect(mockService.create).toHaveBeenCalledWith(dto, 'seller-1');
      expect(result).toEqual(mockAuction);
    });

    it('should throw error when creation fails', async () => {
      const dto: CreateAuctionDto = {
        nftContractId: 'C',
        nftTokenId: 'T',
        startPrice: 1,
        endTime: new Date().toISOString(),
      };
      const mockReq = { user: { userId: 'seller-1' } };
      mockService.create.mockRejectedValueOnce(
        new BadRequestException('NFT already in active auction'),
      );

      await expect(
        controller.create(dto, mockReq as ControllerReq),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('placeBid', () => {
    it('should place bid with bidder from request', async () => {
      const dto: PlaceBidDto = { amount: 10 };
      const mockReq = { user: { userId: 'bidder-1' } };
      const mockBid = { id: 'b1', amount: 10, bidderId: 'bidder-1' };
      mockService.placeBid.mockResolvedValueOnce(mockBid);

      const result = await controller.placeBid(
        'a1',
        dto,
        mockReq as ControllerReq,
      );

      expect(mockService.placeBid).toHaveBeenCalledWith('a1', 'bidder-1', dto);
      expect(result).toEqual(mockBid);
    });

    it('should throw error for invalid bid', async () => {
      const dto: PlaceBidDto = { amount: 5 };
      const mockReq = { user: { userId: 'bidder-1' } };
      mockService.placeBid.mockRejectedValueOnce(
        new BadRequestException('Bid must be greater than current price'),
      );

      await expect(
        controller.placeBid('a1', dto, mockReq as ControllerReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for invalid auction', async () => {
      const dto: PlaceBidDto = { amount: 10 };
      const mockReq = { user: { userId: 'bidder-1' } };
      mockService.placeBid.mockRejectedValueOnce(
        new NotFoundException('Auction not found'),
      );

      await expect(
        controller.placeBid('invalid', dto, mockReq as ControllerReq),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel auction when seller requests', async () => {
      const mockReq = { user: { userId: 'seller-1' } };
      const mockResult = { id: 'a1', status: 'CANCELLED' };
      mockService.cancelAuction.mockResolvedValueOnce(mockResult);

      const result = await controller.cancel('a1', mockReq as ControllerReq);

      expect(mockService.cancelAuction).toHaveBeenCalledWith('a1', 'seller-1');
      expect(result).toEqual(mockResult);
    });

    it('should throw ForbiddenException when non-seller tries to cancel', async () => {
      const mockReq = { user: { userId: 'other-user' } };
      mockService.cancelAuction.mockRejectedValueOnce(
        new ForbiddenException('Only seller can cancel'),
      );

      await expect(
        controller.cancel('a1', mockReq as ControllerReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for non-active auction', async () => {
      const mockReq = { user: { userId: 'seller-1' } };
      mockService.cancelAuction.mockRejectedValueOnce(
        new BadRequestException('Auction not active'),
      );

      await expect(
        controller.cancel('a1', mockReq as ControllerReq),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('settle', () => {
    it('should settle auction successfully', async () => {
      const mockReq = { user: { userId: 'seller-1' } };
      const mockResult = {
        settled: true,
        winner: 'bidder-1',
        amount: 100,
      };
      mockService.settleAuction.mockResolvedValueOnce(mockResult);

      const result = await controller.settle('a1', mockReq as ControllerReq);

      expect(mockService.settleAuction).toHaveBeenCalledWith('a1', 'seller-1');
      expect(result).toEqual(mockResult);
    });

    it('should settle auction without callerId', async () => {
      const mockReq = { user: undefined };
      const mockResult = {
        settled: true,
        winner: 'bidder-1',
        amount: 100,
      };
      mockService.settleAuction.mockResolvedValueOnce(mockResult);

      const result = await controller.settle('a1', mockReq as ControllerReq);

      expect(mockService.settleAuction).toHaveBeenCalledWith('a1', undefined);
      expect(result).toEqual(mockResult);
    });

    it('should throw ForbiddenException when non-seller settles early', async () => {
      const mockReq = { user: { userId: 'other-user' } };
      mockService.settleAuction.mockRejectedValueOnce(
        new ForbiddenException('Only seller or admin can settle before end'),
      );

      await expect(
        controller.settle('a1', mockReq as ControllerReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for non-active auction', async () => {
      const mockReq = { user: { userId: 'seller-1' } };
      mockService.settleAuction.mockRejectedValueOnce(
        new BadRequestException('Auction not active'),
      );

      await expect(
        controller.settle('a1', mockReq as ControllerReq),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
