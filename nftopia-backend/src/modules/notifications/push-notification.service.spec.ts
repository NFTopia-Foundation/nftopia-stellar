import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import * as webpush from 'web-push';
import { PushNotificationService } from './push-notification.service';
import { PushSubscription } from './entities/push-subscription.entity';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('PushNotificationService (#661)', () => {
  let service: PushNotificationService;

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((entity: Partial<PushSubscription>) => entity),
    save: jest.fn((entity: PushSubscription) => Promise.resolve(entity)),
    delete: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        VAPID_PUBLIC_KEY: 'public-key',
        VAPID_PRIVATE_KEY: 'private-key',
        VAPID_SUBJECT: 'mailto:test@nftopia.example',
      };
      return values[key] ?? fallback;
    }),
  };

  async function buildService(
    configOverrides: Record<string, string | undefined> = {},
  ): Promise<PushNotificationService> {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key in configOverrides) return configOverrides[key];
        return mockConfig.get(key, fallback);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: getRepositoryToken(PushSubscription), useValue: mockRepo },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    return module.get(PushNotificationService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('VAPID configuration', () => {
    it('configures web-push when VAPID keys are present', async () => {
      await buildService();
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@nftopia.example',
        'public-key',
        'private-key',
      );
    });

    it('does not configure web-push when VAPID keys are missing', async () => {
      await buildService({
        VAPID_PUBLIC_KEY: undefined,
        VAPID_PRIVATE_KEY: undefined,
      });
      expect(webpush.setVapidDetails).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      service = await buildService();
    });

    it('creates a new subscription when the endpoint is unseen', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.subscribe('user-1', {
        endpoint: 'https://push.example/abc',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      });

      expect(mockRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        endpoint: 'https://push.example/abc',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('updates the existing row instead of duplicating when the endpoint is already known', async () => {
      const existing = {
        id: 'sub-1',
        userId: 'old-user',
        endpoint: 'https://push.example/abc',
        p256dh: 'old',
        auth: 'old',
      };
      mockRepo.findOne.mockResolvedValue(existing);

      await service.subscribe('user-2', {
        endpoint: 'https://push.example/abc',
        keys: { p256dh: 'new-p256dh', auth: 'new-auth' },
      });

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sub-1',
          userId: 'user-2',
          p256dh: 'new-p256dh',
          auth: 'new-auth',
        }),
      );
    });
  });

  describe('unsubscribe', () => {
    it('deletes the subscription by endpoint', async () => {
      service = await buildService();
      await service.unsubscribe('https://push.example/abc');
      expect(mockRepo.delete).toHaveBeenCalledWith({
        endpoint: 'https://push.example/abc',
      });
    });
  });

  describe('sendToUser', () => {
    it('does nothing when VAPID is not configured', async () => {
      service = await buildService({
        VAPID_PUBLIC_KEY: undefined,
        VAPID_PRIVATE_KEY: undefined,
      });

      await service.sendToUser('user-1', { title: 'Hi', body: 'There' });

      expect(mockRepo.find).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('sends a push to every subscription the user has', async () => {
      service = await buildService();
      mockRepo.find.mockResolvedValue([
        { id: 'sub-1', endpoint: 'ep-1', p256dh: 'p1', auth: 'a1' },
        { id: 'sub-2', endpoint: 'ep-2', p256dh: 'p2', auth: 'a2' },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      await service.sendToUser('user-1', {
        title: 'New Bid',
        body: 'A bid of 10 XLM was placed.',
      });

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        { endpoint: 'ep-1', keys: { p256dh: 'p1', auth: 'a1' } },
        JSON.stringify({
          title: 'New Bid',
          body: 'A bid of 10 XLM was placed.',
        }),
      );
    });

    it('prunes a subscription the push service reports as gone (410)', async () => {
      service = await buildService();
      mockRepo.find.mockResolvedValue([
        { id: 'sub-1', endpoint: 'ep-1', p256dh: 'p1', auth: 'a1' },
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 410,
      });

      await service.sendToUser('user-1', { title: 'Hi', body: 'There' });

      expect(mockRepo.delete).toHaveBeenCalledWith({ id: 'sub-1' });
    });

    it('logs but does not prune on a non-expiry delivery failure', async () => {
      service = await buildService();
      mockRepo.find.mockResolvedValue([
        { id: 'sub-1', endpoint: 'ep-1', p256dh: 'p1', auth: 'a1' },
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 500,
        message: 'upstream error',
      });

      await expect(
        service.sendToUser('user-1', { title: 'Hi', body: 'There' }),
      ).resolves.toBeUndefined();

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });
});
