import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuctionService } from './auction.service';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { User } from '../../users/user.entity';
import { AuctionStatus } from './interfaces/auction.interface';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionState } from '../transaction/enums/transaction-state.enum';
import { NotificationsService } from '../notifications/notifications.service';

describe('AuctionService — settlement winner notification', () => {
  let service: AuctionService;

  const auctionRepo = {
    findOne: jest.fn(),
    save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
  };

  const bidRepo = {
    findOne: jest.fn(),
  };

  const nftRepo = {
    findOne: jest.fn(),
  };

  const userRepo = {
    findOne: jest.fn(),
  };

  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'ENABLE_ONCHAIN_SETTLEMENT') return false;
      return undefined;
    }),
  };

  const settlementClient = {
    placeBid: jest.fn(),
    createAuction: jest.fn(),
  };

  const transactionService = {
    createAndExecuteAuctionSettlement: jest.fn(),
  };

  const notificationsService = {
    notifyUser: jest.fn(),
    notifyAuctionWonByEmail: jest.fn(),
  };

  const activeAuction: Auction = {
    id: 'auction-1',
    nftContractId: 'C1',
    nftTokenId: 'T1',
    sellerId: 'seller-1',
    startPrice: 10,
    currentPrice: 10,
    reservePrice: 0,
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(Date.now() - 1_000),
    status: AuctionStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        { provide: getRepositoryToken(Auction), useValue: auctionRepo },
        { provide: getRepositoryToken(Bid), useValue: bidRepo },
        { provide: getRepositoryToken(StellarNft), useValue: nftRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ConfigService, useValue: configService },
        { provide: MarketplaceSettlementClient, useValue: settlementClient },
        { provide: TransactionService, useValue: transactionService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(AuctionService);

    auctionRepo.findOne.mockResolvedValue({ ...activeAuction });
    bidRepo.findOne.mockResolvedValue({
      auctionId: 'auction-1',
      bidderId: 'bidder-1',
      amount: 25,
    });
    transactionService.createAndExecuteAuctionSettlement.mockResolvedValue({
      id: 'tx-1',
      state: TransactionState.COMPLETED,
    });
    userRepo.findOne.mockResolvedValue({
      id: 'bidder-1',
      email: 'winner@nftopia.io',
      username: 'winner1',
    });
    nftRepo.findOne.mockResolvedValue({
      contractId: 'C1',
      tokenId: 'T1',
      metadata: { name: 'Stellar Punk #7' },
    });
  });

  it('notifies the winner by websocket and email after settlement', async () => {
    await service.settleAuction('auction-1');

    expect(notificationsService.notifyUser).toHaveBeenCalledWith(
      'bidder-1',
      'auction.won',
      'You Won!',
      expect.stringContaining('Stellar Punk #7'),
      expect.objectContaining({ auctionId: 'auction-1' }),
    );

    expect(notificationsService.notifyAuctionWonByEmail).toHaveBeenCalledWith(
      'winner@nftopia.io',
      'auction-1',
      'Stellar Punk #7',
      'winner1',
    );
  });

  it('falls back to a generic NFT name when metadata is missing', async () => {
    nftRepo.findOne.mockResolvedValue(null);

    await service.settleAuction('auction-1');

    expect(notificationsService.notifyAuctionWonByEmail).toHaveBeenCalledWith(
      'winner@nftopia.io',
      'auction-1',
      'NFT T1',
      'winner1',
    );
  });

  it('skips the email when the winner has no email on file', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'bidder-1', email: null });

    await service.settleAuction('auction-1');

    expect(notificationsService.notifyUser).toHaveBeenCalled();
    expect(notificationsService.notifyAuctionWonByEmail).not.toHaveBeenCalled();
  });

  it('does not fail settlement when winner notification throws', async () => {
    userRepo.findOne.mockRejectedValue(new Error('db down'));

    await expect(service.settleAuction('auction-1')).resolves.toEqual(
      expect.objectContaining({ settled: true, winner: 'bidder-1' }),
    );
  });
});
