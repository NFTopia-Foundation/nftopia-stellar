import { Test, TestingModule } from '@nestjs/testing';
import { AuctionService } from './auction.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { AuctionStatus } from './interfaces/auction.interface';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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

const mockEntityManager = {
  findOne: jest.fn().mockImplementation((entity: unknown, opts: unknown) => {
    if (entity === Auction)
      return mockAuctionRepo.findOne(opts) as Promise<Auction | null>;
    return Promise.resolve(null);
  }),
  create: jest.fn().mockImplementation((entity: unknown, dto: unknown) => {
    if (entity === Bid) return mockBidRepo.create(dto) as Bid;
    return dto;
  }),
  save: jest.fn().mockImplementation((entity: unknown, data: unknown) => {
    if (entity === Auction)
      return mockAuctionRepo.save(data) as Promise<Auction>;
    if (entity === Bid) {
      void mockBidRepo.save(data);
      return Promise.resolve(data);
    }
    return Promise.resolve(data);
  }),
};

const mockDataSource = {
  transaction: jest
    .fn()
    .mockImplementation((cb: (manager: unknown) => unknown) =>
      cb(mockEntityManager),
    ),
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

    mockDataSource.transaction.mockImplementation(
      (cb: (manager: unknown) => unknown) => cb(mockEntityManager),
    );

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
        { provide: DataSource, useValue: mockDataSource },
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
        sellerId: 'seller-1',
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

    it('extends the auction and notifies clients for a bid in the extension window', async () => {
      const originalEndTime = new Date(Date.now() + 60_000);
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        endTime: originalEndTime,
        currentPrice: 1,
        extensionCount: 0,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await service.placeBid('a1', 'b1', { amount: 2 });

      expect(auction.endTime).toEqual(
        new Date(originalEndTime.getTime() + 300_000),
      );
      expect(auction.extensionCount).toBe(1);
      expect(
        mockNotificationsService.broadcastAuctionExtended,
      ).toHaveBeenCalledWith('a1', {
        endTime: auction.endTime.toISOString(),
        extensionCount: 1,
      });
    });

    it('does not extend the auction for a bid outside the extension window', async () => {
      const originalEndTime = new Date(Date.now() + 600_000);
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        endTime: originalEndTime,
        currentPrice: 1,
        extensionCount: 0,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await service.placeBid('a1', 'b1', { amount: 2 });

      expect(auction.endTime).toBe(originalEndTime);
      expect(auction.extensionCount).toBe(0);
      expect(
        mockNotificationsService.broadcastAuctionExtended,
      ).not.toHaveBeenCalled();
    });

    it('does not extend the auction after reaching the extension cap', async () => {
      const originalEndTime = new Date(Date.now() + 60_000);
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        endTime: originalEndTime,
        currentPrice: 1,
        extensionCount: 3,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await service.placeBid('a1', 'b1', { amount: 2 });

      expect(auction.endTime).toBe(originalEndTime);
      expect(auction.extensionCount).toBe(3);
      expect(
        mockNotificationsService.broadcastAuctionExtended,
      ).not.toHaveBeenCalled();
    });

    it('should reject bid on non-active auction', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.COMPLETED,
        endTime: new Date(Date.now() + 10000),
        currentPrice: 1,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      const rejection = await captureRejection(
        service.placeBid('a1', 'b1', { amount: 2 }),
      );
      expect(rejection).toBeInstanceOf(BadRequestException);
      expect(rejection).toHaveProperty('message', 'Auction is not active');
    });

    it('should reject bid on expired auction', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        endTime: new Date(Date.now() - 1000),
        currentPrice: 1,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      const rejection = await captureRejection(
        service.placeBid('a1', 'b1', { amount: 2 }),
      );
      expect(rejection).toBeInstanceOf(BadRequestException);
      expect(rejection).toHaveProperty('message', 'Auction expired');
    });

    it('should reject bid lower than or equal to current price', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        endTime: new Date(Date.now() + 10000),
        currentPrice: 5,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      const rejection = await captureRejection(
        service.placeBid('a1', 'b1', { amount: 3 }),
      );
      expect(rejection).toBeInstanceOf(BadRequestException);
      expect(rejection).toHaveProperty(
        'message',
        'Bid must be greater than current price',
      );

      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
      await expect(service.placeBid('a1', 'b1', { amount: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if auction not found', async () => {
      mockAuctionRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.placeBid('nonexistent', 'b1', { amount: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('acquires a pessimistic_write lock on the auction row inside a database transaction', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        endTime: new Date(Date.now() + 10000),
        currentPrice: 1,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await service.placeBid('a1', 'b1', { amount: 5 });

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(Auction, {
        where: { id: 'a1' },
        lock: { mode: 'pessimistic_write' },
      });
    });

    describe('concurrency protection for simultaneous bids', () => {
      it('serializes simultaneous bids of identical amounts so exactly one wins and the competing bid is rejected', async () => {
        const auctionState: Auction = {
          id: 'auction-concurrent-1',
          status: AuctionStatus.ACTIVE,
          sellerId: 'seller-1',
          endTime: new Date(Date.now() + 600_000),
          currentPrice: 10,
          startPrice: 10,
          extensionCount: 0,
        } as Auction;

        const persistedBids: Bid[] = [];
        let rowLockHeld = false;
        const waitingResolvers: Array<() => void> = [];

        const acquireRowLock = async () => {
          if (rowLockHeld) {
            await new Promise<void>((resolve) =>
              waitingResolvers.push(resolve),
            );
          }
          rowLockHeld = true;
        };

        const releaseRowLock = () => {
          rowLockHeld = false;
          const next = waitingResolvers.shift();
          if (next) next();
        };

        mockDataSource.transaction.mockImplementation(
          async (cb: (manager: unknown) => Promise<unknown>) => {
            await acquireRowLock();
            try {
              const manager = {
                findOne: jest.fn().mockImplementation((entity: unknown) => {
                  if (entity === Auction) {
                    return Promise.resolve({ ...auctionState });
                  }
                  return Promise.resolve(null);
                }),
                create: jest
                  .fn()
                  .mockImplementation((entity: unknown, dto: Partial<Bid>) => ({
                    id: `bid-${persistedBids.length + 1}`,
                    ...dto,
                  })),
                save: jest
                  .fn()
                  .mockImplementation((entity: unknown, item: unknown) => {
                    if (entity === Auction) {
                      const typed = item as Auction;
                      auctionState.currentPrice = typed.currentPrice;
                      auctionState.endTime = typed.endTime;
                      auctionState.extensionCount = typed.extensionCount;
                      return Promise.resolve({ ...auctionState });
                    }
                    if (entity === Bid) {
                      persistedBids.push(item as Bid);
                      return Promise.resolve(item);
                    }
                    return Promise.resolve(item);
                  }),
              };
              return await cb(manager);
            } finally {
              releaseRowLock();
            }
          },
        );

        // Two simultaneous bids submitted at the same time with identical amounts (15)
        const [result1, result2] = await Promise.allSettled([
          service.placeBid('auction-concurrent-1', 'bidder-1', { amount: 15 }),
          service.placeBid('auction-concurrent-1', 'bidder-2', { amount: 15 }),
        ]);

        const fulfilled = [result1, result2].filter(
          (r) => r.status === 'fulfilled',
        );
        const rejected = [result1, result2].filter(
          (r) => r.status === 'rejected',
        );

        // Exactly one must win and the other must be rejected
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        const rejectionReason = rejected[0].reason as Error;
        expect(rejectionReason).toBeInstanceOf(BadRequestException);
        expect(rejectionReason.message).toBe(
          'Bid must be greater than current price',
        );

        // Final state is completely consistent
        expect(auctionState.currentPrice).toBe(15);
        expect(persistedBids).toHaveLength(1);
        expect(persistedBids[0].amount).toBe(15);
      });

      it('ensures competing simultaneous bids of different amounts always yield the higher price without regression', async () => {
        const auctionState: Auction = {
          id: 'auction-concurrent-2',
          status: AuctionStatus.ACTIVE,
          sellerId: 'seller-1',
          endTime: new Date(Date.now() + 600_000),
          currentPrice: 10,
          startPrice: 10,
          extensionCount: 0,
        } as Auction;

        const persistedBids: Bid[] = [];
        let rowLockHeld = false;
        const waitingResolvers: Array<() => void> = [];

        const acquireRowLock = async () => {
          if (rowLockHeld) {
            await new Promise<void>((resolve) =>
              waitingResolvers.push(resolve),
            );
          }
          rowLockHeld = true;
        };

        const releaseRowLock = () => {
          rowLockHeld = false;
          const next = waitingResolvers.shift();
          if (next) next();
        };

        mockDataSource.transaction.mockImplementation(
          async (cb: (manager: unknown) => Promise<unknown>) => {
            await acquireRowLock();
            try {
              const manager = {
                findOne: jest.fn().mockImplementation((entity: unknown) => {
                  if (entity === Auction) {
                    return Promise.resolve({ ...auctionState });
                  }
                  return Promise.resolve(null);
                }),
                create: jest
                  .fn()
                  .mockImplementation((entity: unknown, dto: Partial<Bid>) => ({
                    id: `bid-${persistedBids.length + 1}`,
                    ...dto,
                  })),
                save: jest
                  .fn()
                  .mockImplementation((entity: unknown, item: unknown) => {
                    if (entity === Auction) {
                      const typed = item as Auction;
                      auctionState.currentPrice = typed.currentPrice;
                      return Promise.resolve({ ...auctionState });
                    }
                    if (entity === Bid) {
                      persistedBids.push(item as Bid);
                      return Promise.resolve(item);
                    }
                    return Promise.resolve(item);
                  }),
              };
              return await cb(manager);
            } finally {
              releaseRowLock();
            }
          },
        );

        // Two concurrent bids: bidder-A offers 12, bidder-B offers 16
        const [, resB] = await Promise.allSettled([
          service.placeBid('auction-concurrent-2', 'bidder-A', { amount: 12 }),
          service.placeBid('auction-concurrent-2', 'bidder-B', { amount: 16 }),
        ]);

        // In both interleavings, final currentPrice must be 16
        expect(auctionState.currentPrice).toBe(16);
        // The highest bid of 16 must have succeeded
        expect(resB.status).toBe('fulfilled');
      });
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
        ForbiddenException,
      );
      await expect(service.cancelAuction('a1', 'other')).rejects.toThrow(
        'Only seller can cancel',
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
        BadRequestException,
      );
      await expect(service.cancelAuction('a1', 's1')).rejects.toThrow(
        'Auction not active',
      );
    });
  });

  describe('settleAuction', () => {
    it('should settle auction with no bids', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        endTime: new Date(Date.now() - 1000),
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
      mockBidRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.settleAuction('a1');
      expect(result.settled).toBe(false);
      expect(result.reason).toBe('No bids');
      expect(mockAuctionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuctionStatus.COMPLETED }),
      );
    });

    it('should settle when reserve not met', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        reservePrice: 10,
        endTime: new Date(Date.now() - 1000),
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
      mockBidRepo.findOne.mockResolvedValueOnce({
        bidderId: 'b1',
        amount: 5,
      });

      const result = await service.settleAuction('a1');
      expect(result.settled).toBe(false);
      expect(result.reason).toBe('Reserve not met');
    });

    it('should successfully settle auction with winning bid', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.ACTIVE,
        sellerId: 'seller-1',
        endTime: new Date(Date.now() - 1000),
        nftContractId: 'C',
        nftTokenId: 'T',
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
      mockBidRepo.findOne.mockResolvedValueOnce({
        bidderId: 'b1',
        amount: 20,
        bidder: { address: 'addr1' },
      });
      mockNftRepo.findOne.mockResolvedValueOnce({
        contractId: 'C',
        tokenId: 'T',
        owner: 'old',
      });

      const result = await service.settleAuction('a1');
      expect(result.settled).toBe(true);
      expect(result.winner).toBe('b1');
      expect(result.amount).toBe(20);
      expect(
        mockTransactionService.createAndExecuteAuctionSettlement,
      ).toHaveBeenCalledWith('a1', 'b1', 20);
      expect(mockAuctionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AuctionStatus.SETTLED,
          winnerId: 'b1',
        }),
      );
    });

    it('should reject settlement of non-active auction', async () => {
      const auction = {
        id: 'a1',
        status: AuctionStatus.COMPLETED,
      } as unknown as Auction;
      mockAuctionRepo.findOne.mockResolvedValueOnce(auction);

      await expect(service.settleAuction('a1')).rejects.toThrow(
        BadRequestException,
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
      });
      mockNftRepo.findOne.mockResolvedValueOnce({
        contractId: 'C',
        tokenId: 'T',
        owner: 'old',
      });

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

      const rejection = await captureRejection(
        service.settleAuction('a1', 'other'),
      );
      expect(rejection).toBeInstanceOf(ForbiddenException);
      expect(rejection).toHaveProperty(
        'message',
        'Only seller or admin can settle before end',
      );
    });
  });
});
