import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BidEventListener } from './bid-event.listener';
import { Bid, BidSorobanStatus } from '../../auction/entities/bid.entity';
import { User } from '../../../users/user.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { PushNotificationService } from '../../notifications/push-notification.service';
import { BID_CACHE_PREFIX } from '../interfaces/bid.interface';

describe('BidEventListener', () => {
  let listener: BidEventListener;

  const bidRepo = {
    findOne: jest.fn(),
  };

  const userRepo = {
    findOne: jest.fn(),
  };

  const cacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const notificationsService = {
    notifyUser: jest.fn(),
    broadcastBidUpdate: jest.fn(),
    notifyBidReceivedByEmail: jest.fn(),
  };

  const pushNotificationService = {
    sendToUser: jest.fn(),
  };

  const payload = {
    bidId: 'bid-1',
    auctionId: 'auction-1',
    sellerId: 'seller-1',
    bidderId: 'bidder-1',
    stellarPublicKey:
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    amount: 100,
    amountXlm: '100.0000000',
    txHash: 'tx-hash',
    ledgerSequence: 99,
    sorobanStatus: BidSorobanStatus.CONFIRMED,
    timestamp: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    userRepo.findOne.mockResolvedValue({
      id: 'seller-1',
      email: 'seller@nftopia.io',
      username: 'seller1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidEventListener,
        { provide: getRepositoryToken(Bid), useValue: bidRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: PushNotificationService,
          useValue: pushNotificationService,
        },
      ],
    }).compile();

    listener = module.get(BidEventListener);
  });

  it('refreshes cache, notifies seller, and broadcasts bid update', async () => {
    cacheManager.get.mockResolvedValue(null);

    await listener.handleBidPlaced(payload);

    expect(cacheManager.set).toHaveBeenCalledWith(
      `${BID_CACHE_PREFIX}${payload.auctionId}`,
      expect.objectContaining({
        auctionId: payload.auctionId,
        amount: payload.amount,
        bidderId: payload.bidderId,
      }),
      expect.any(Number),
    );

    expect(notificationsService.notifyUser).toHaveBeenCalledWith(
      payload.sellerId,
      'bid.received',
      'New Bid',
      `A bid of ${payload.amountXlm} XLM was placed on your auction`,
      expect.objectContaining({ auctionId: payload.auctionId }),
    );

    expect(notificationsService.broadcastBidUpdate).toHaveBeenCalledWith(
      payload.auctionId,
      expect.objectContaining({
        auctionId: payload.auctionId,
        amount: payload.amount,
        bidderId: payload.bidderId,
      }),
    );

    expect(notificationsService.notifyBidReceivedByEmail).toHaveBeenCalledWith(
      'seller@nftopia.io',
      payload.auctionId,
      payload.amount,
      'seller1',
    );

    expect(pushNotificationService.sendToUser).toHaveBeenCalledWith(
      payload.sellerId,
      expect.objectContaining({ title: 'New Bid' }),
    );
    const [, pushPayload] = pushNotificationService.sendToUser.mock
      .calls[0] as [string, { body: string; url: string }];
    expect(pushPayload.body).toContain(payload.amountXlm);
    expect(pushPayload.url).toContain(payload.auctionId);
  });

  it('skips the seller email when the seller has no email on file', async () => {
    cacheManager.get.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValueOnce({ id: 'seller-1', email: null });

    await listener.handleBidPlaced(payload);

    expect(
      notificationsService.notifyBidReceivedByEmail,
    ).not.toHaveBeenCalled();
  });

  it('does not overwrite cache when existing highest bid is greater', async () => {
    cacheManager.get.mockResolvedValue({ amount: 150 });

    await listener.handleBidPlaced(payload);

    expect(cacheManager.set).not.toHaveBeenCalled();
    expect(notificationsService.notifyUser).toHaveBeenCalled();
    expect(notificationsService.broadcastBidUpdate).toHaveBeenCalled();
  });

  it('logs and swallows errors from handler', async () => {
    cacheManager.get.mockRejectedValue(new Error('cache down'));
    const loggerHost = listener as unknown as {
      logger: { error: (...args: unknown[]) => void };
    };
    const errorSpy = jest.spyOn(loggerHost.logger, 'error');

    await expect(listener.handleBidPlaced(payload)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });
});
