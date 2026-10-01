import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailTemplateService } from './template.service';
import { EmailLog, EmailStatus, EmailType } from './entities/email-log.entity';
import {
  EMAIL_QUEUE_NAME,
  SEND_EMAIL_JOB,
} from './interfaces/email-job.interface';

describe('EmailService', () => {
  let service: EmailService;

  const emailLogRepo = {
    create: jest.fn((data: Partial<EmailLog>) => data as EmailLog),
    save: jest.fn(
      (data: EmailLog) =>
        Promise.resolve({ ...data, id: 'log-1' }) as Promise<EmailLog>,
    ),
    update: jest.fn(),
  };

  const emailQueue = {
    add: jest.fn(),
  };

  const templateService = {
    render: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    templateService.render.mockReturnValue({
      html: '<p>hi</p>',
      text: 'hi',
    });
    emailQueue.add.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getRepositoryToken(EmailLog), useValue: emailLogRepo },
        { provide: getQueueToken(EMAIL_QUEUE_NAME), useValue: emailQueue },
        { provide: EmailTemplateService, useValue: templateService },
      ],
    }).compile();

    service = moduleRef.get(EmailService);
  });

  describe('sendVerificationEmail', () => {
    it('renders the verification template and enqueues a send job', async () => {
      await service.sendVerificationEmail(
        'user@nftopia.io',
        'token-123',
        'builder',
      );

      expect(templateService.render).toHaveBeenCalledWith(
        'verification-email',
        expect.objectContaining({
          username: 'builder',
          verificationUrl: 'http://localhost:3001/verify-email?token=token-123',
        }),
      );

      expect(emailLogRepo.save).toHaveBeenCalled();
      const savedLog = emailLogRepo.save.mock.calls[0][0];
      expect(savedLog.type).toBe(EmailType.VERIFICATION);
      expect(savedLog.status).toBe(EmailStatus.QUEUED);

      expect(emailQueue.add).toHaveBeenCalledWith(
        SEND_EMAIL_JOB,
        expect.objectContaining({
          logId: 'log-1',
          to: 'user@nftopia.io',
          type: EmailType.VERIFICATION,
        }),
        expect.objectContaining({ attempts: 5 }),
      );
    });

    it('defaults the username when none is provided', async () => {
      await service.sendVerificationEmail('user@nftopia.io', 'token-123');

      expect(templateService.render).toHaveBeenCalledWith(
        'verification-email',
        expect.objectContaining({ username: 'there' }),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('renders the password-reset template and enqueues a send job', async () => {
      await service.sendPasswordResetEmail(
        'user@nftopia.io',
        'reset-token',
        'builder',
      );

      expect(templateService.render).toHaveBeenCalledWith(
        'password-reset',
        expect.objectContaining({
          username: 'builder',
          resetUrl: 'http://localhost:3001/reset-password?token=reset-token',
        }),
      );

      const savedLog = emailLogRepo.save.mock.calls[0][0];
      expect(savedLog.type).toBe(EmailType.PASSWORD_RESET);
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('queues a password-change notification', async () => {
      await service.sendPasswordChangedEmail('user@nftopia.io', 'builder');

      expect(templateService.render).toHaveBeenCalledWith('password-changed', {
        username: 'builder',
      });
      const savedLog = emailLogRepo.save.mock.calls[0][0];
      expect(savedLog.type).toBe(EmailType.PASSWORD_CHANGED);
    });
  });

  describe('sendAccountDeletionVerificationEmail', () => {
    it('queues a time-limited account deletion verification email', async () => {
      await service.sendAccountDeletionVerificationEmail(
        'user@nftopia.io',
        'deletion-token',
        'builder',
      );

      const expectedTemplateVars: Record<string, unknown> = {
        username: 'builder',
        verificationUrl: expect.stringContaining('/account/deletion?token='),
      };
      expect(templateService.render).toHaveBeenCalledWith(
        'account-deletion-verification',
        expect.objectContaining(expectedTemplateVars),
      );
      const savedLog = emailLogRepo.save.mock.calls[0][0];
      expect(savedLog.type).toBe(EmailType.ACCOUNT_DELETION_VERIFICATION);
    });
  });

  describe('sendBidNotificationEmail', () => {
    it('renders the bid-notification template and enqueues a send job', async () => {
      await service.sendBidNotificationEmail(
        'seller@nftopia.io',
        'auction-1',
        150,
        'seller1',
      );

      expect(templateService.render).toHaveBeenCalledWith(
        'bid-notification',
        expect.objectContaining({
          auctionId: 'auction-1',
          amount: '150.00',
        }),
      );

      const savedLog = emailLogRepo.save.mock.calls[0][0];
      expect(savedLog.type).toBe(EmailType.BID_NOTIFICATION);
      expect(savedLog.metadata).toEqual({
        auctionId: 'auction-1',
        amount: 150,
      });
    });
  });

  describe('sendAuctionWonEmail', () => {
    it('renders the auction-won template and enqueues a send job', async () => {
      await service.sendAuctionWonEmail(
        'winner@nftopia.io',
        'auction-1',
        'Stellar Punk #7',
        'winner1',
      );

      expect(templateService.render).toHaveBeenCalledWith(
        'auction-won',
        expect.objectContaining({
          nftName: 'Stellar Punk #7',
        }),
      );

      const savedLog = emailLogRepo.save.mock.calls[0][0];
      expect(savedLog.type).toBe(EmailType.AUCTION_WON);
      expect(savedLog.subject).toContain('Stellar Punk #7');
    });
  });

  describe('enqueue failures', () => {
    it('marks the log FAILED when the queue add rejects', async () => {
      emailQueue.add.mockRejectedValueOnce(new Error('redis unavailable'));

      await service.sendVerificationEmail('user@nftopia.io', 'token-123');

      expect(emailLogRepo.update).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({
          status: EmailStatus.FAILED,
          error: 'redis unavailable',
        }),
      );
    });

    it('does not throw when the queue add rejects', async () => {
      emailQueue.add.mockRejectedValueOnce(new Error('redis unavailable'));

      await expect(
        service.sendVerificationEmail('user@nftopia.io', 'token-123'),
      ).resolves.toBeUndefined();
    });
  });
});
