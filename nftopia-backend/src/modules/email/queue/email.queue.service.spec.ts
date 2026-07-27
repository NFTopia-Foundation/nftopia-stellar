import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailQueueService } from './email.queue.service';
import { Queue } from 'bullmq';

describe('EmailQueueService', () => {
  let service: EmailQueueService;
  let emailQueue: Queue;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(5),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    clean: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailQueueService,
        {
          provide: getQueueToken('email'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<EmailQueueService>(EmailQueueService);
    emailQueue = module.get<Queue>(getQueueToken('email'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queueEmail', () => {
    it('should add job to queue with correct options', async () => {
      await service.queueEmail(
        'verification',
        'test@example.com',
        'Verify Email',
        { username: 'TestUser' },
        10,
      );

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          templateName: 'verification',
          to: 'test@example.com',
          subject: 'Verify Email',
          data: { username: 'TestUser' },
          priority: 10,
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({ type: 'exponential' }),
        }),
      );
    });

    it('should throw when queue.add fails', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(
        service.queueEmail('verification', 'test@example.com', 'Subject', {}),
      ).rejects.toThrow('Redis connection failed');
    });
  });

  describe('queueVerificationEmail', () => {
    it('should queue verification email with high priority', async () => {
      await service.queueVerificationEmail(
        'test@example.com',
        'TestUser',
        'http://localhost:3001/verify?token=abc',
      );

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          templateName: 'verification',
          to: 'test@example.com',
          subject: 'Verify Your NFTopia Email',
          data: expect.objectContaining({
            username: 'TestUser',
            verificationUrl: 'http://localhost:3001/verify?token=abc',
            expiryHours: 24,
          }),
          priority: 10,
        }),
        expect.anything(),
      );
    });
  });

  describe('queuePasswordResetEmail', () => {
    it('should queue password reset email with high priority', async () => {
      await service.queuePasswordResetEmail(
        'test@example.com',
        'TestUser',
        'http://localhost:3001/reset?token=xyz',
      );

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          templateName: 'password-reset',
          to: 'test@example.com',
          subject: 'Reset Your NFTopia Password',
          priority: 10,
        }),
        expect.anything(),
      );
    });
  });

  describe('queueBidNotificationEmail', () => {
    it('should queue bid notification email with medium priority', async () => {
      await service.queueBidNotificationEmail(
        'owner@example.com',
        'OwnerUser',
        'CoolNFT #1',
        'BidderUser',
        '150.00',
        'http://localhost:3001/auction/123',
        'Cool Collection',
      );

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          templateName: 'bid-notification',
          to: 'owner@example.com',
          subject: 'New Bid on CoolNFT #1',
          priority: 5,
          data: expect.objectContaining({
            nftName: 'CoolNFT #1',
            bidderName: 'BidderUser',
            bidAmount: '150.00',
            collectionName: 'Cool Collection',
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe('queueAuctionWonEmail', () => {
    it('should queue auction won email with high priority', async () => {
      await service.queueAuctionWonEmail(
        'winner@example.com',
        'WinnerUser',
        'Rare NFT',
        'SellerUser',
        '500.00',
        'http://localhost:3001/nft/456',
      );

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          templateName: 'auction-won',
          to: 'winner@example.com',
          subject: 'Congratulations! You Won Rare NFT',
          priority: 8,
          data: expect.objectContaining({
            winningAmount: '500.00',
            sellerName: 'SellerUser',
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 5,
        failed: 0,
        delayed: 0,
      });
    });
  });

  describe('cleanOldJobs', () => {
    it('should clean old completed and failed jobs', async () => {
      await service.cleanOldJobs();

      expect(emailQueue.clean).toHaveBeenCalledTimes(2);
    });
  });
});
