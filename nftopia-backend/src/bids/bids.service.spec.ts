import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BidsService } from './bids.service';
import { Bid } from './entities/bid.entity';
import { Auction } from './entities/auction.entity';
import { SorobanRpcService } from '../soroban/soroban-rpc.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('BidsService', () => {
  let service: BidsService;
  let auctionRepo: { findOne: jest.Mock };
  let bidRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };
  let sorobanRpc: {
    getHighestBidFromContract: jest.Mock;
    simulateTransaction: jest.Mock;
    sendTransaction: jest.Mock;
    waitForTransaction: jest.Mock;
    getLatestLedger: jest.Mock;
  };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  const mockAuction: Partial<Auction> = {
    auctionId: 'auction-1',
    sellerPublicKey: 'GSELLER',
    status: 'Active',
    minIncrement: '0.05',
    reservePriceXlm: '10',
  };

  beforeEach(async () => {
    auctionRepo = { findOne: jest.fn() };
    bidRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };
    sorobanRpc = {
      getHighestBidFromContract: jest.fn().mockResolvedValue(null),
      simulateTransaction: jest.fn().mockResolvedValue({ success: true }),
      sendTransaction: jest.fn().mockResolvedValue({ hash: 'tx-hash' }),
      waitForTransaction: jest.fn().mockResolvedValue(true),
      getLatestLedger: jest.fn().mockResolvedValue(12345),
    };
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidsService,
        { provide: getRepositoryToken(Bid), useValue: bidRepo },
        { provide: getRepositoryToken(Auction), useValue: auctionRepo },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: SorobanRpcService, useValue: sorobanRpc },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'HORIZON_URL' ? 'https://horizon-testnet.stellar.org' : undefined)) },
        },
      ],
    }).compile();

    service = module.get<BidsService>(BidsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHighestBid', () => {
    it('should return from cache when present', async () => {
      const cached = { bidder: 'GXXX', amountStroops: '10000000', amountXlm: '1' };
      cache.get.mockResolvedValue(cached);
      const result = await service.getHighestBid('auction-1');
      expect(result).toEqual(cached);
      expect(sorobanRpc.getHighestBidFromContract).not.toHaveBeenCalled();
    });

    it('should fallback to DB when contract returns null', async () => {
      cache.get.mockResolvedValue(undefined);
      sorobanRpc.getHighestBidFromContract.mockResolvedValue(null);
      bidRepo.findOne.mockResolvedValue({
        auctionId: 'auction-1',
        bidderPublicKey: 'GBIDDER',
        amountStroops: '50000000',
        amountXlm: '5',
        ledgerSequence: 100,
      });
      const result = await service.getHighestBid('auction-1');
      expect(result).not.toBeNull();
      expect(result?.bidder).toBe('GBIDDER');
      expect(result?.amountXlm).toBe('5');
    });
  });

  describe('placeBid', () => {
    it('should throw NotFoundException when auction does not exist', async () => {
      auctionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.placeBid('missing', { amount: '10', signature: 'sig', publicKey: 'GBIDDER', signedTransactionXdr: 'xdr' }, 'GBIDDER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when auction is not Active', async () => {
      auctionRepo.findOne.mockResolvedValue({ ...mockAuction, status: 'Ended' });
      await expect(
        service.placeBid('auction-1', { amount: '10', signature: 'sig', publicKey: 'GBIDDER', signedTransactionXdr: 'xdr' }, 'GBIDDER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when bidding on own auction', async () => {
      auctionRepo.findOne.mockResolvedValue(mockAuction);
      await expect(
        service.placeBid('auction-1', { amount: '10', signature: 'sig', publicKey: 'GSELLER', signedTransactionXdr: 'xdr' }, 'GSELLER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when signedTransactionXdr is missing', async () => {
      auctionRepo.findOne.mockResolvedValue(mockAuction);
      await expect(
        service.placeBid('auction-1', { amount: '10', signature: 'sig', publicKey: 'GBIDDER' }, 'GBIDDER'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBidsByAuction', () => {
    it('should return items and nextCursor', async () => {
      bidRepo.createQueryBuilder = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: '1', auctionId: 'auction-1', bidderPublicKey: 'G1', amountXlm: '1', amountStroops: '10000000', transactionHash: 'h1', ledgerSequence: 10, createdAt: new Date() },
        ]),
      }));
      const result = await service.getBidsByAuction('auction-1', { limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].bidderPublicKey).toBe('G1');
    });
  });
});
