import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('fs');
jest.mock('nodemailer');
jest.mock('handlebars', () => ({
  compile: jest.fn((source: string) => (ctx: Record<string, unknown>) => `${source}:${JSON.stringify(ctx)}`),
}));

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockCreateTransport = nodemailer.createTransport as jest.Mock;

const makeConfig = (overrides: Record<string, string> = {}): jest.Mocked<ConfigService> => {
  const defaults: Record<string, string> = {
    EMAIL_PROVIDER: 'smtp',
    EMAIL_FROM_ADDRESS: 'test@nftopia.io',
    EMAIL_FROM_NAME: 'NFTopia Test',
    APP_URL: 'http://localhost:3000',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => defaults[key] ?? null),
  } as unknown as jest.Mocked<ConfigService>;
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();

    (fs.readFileSync as jest.Mock).mockReturnValue('<html>{{subject}}</html>');
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    service.onModuleInit();

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('sendVerificationEmail', () => {
    it('sends email via SMTP transporter', async () => {
      await service.sendVerificationEmail('user@example.com', 'abc123', 'Alice');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('user@example.com');
      expect(call.subject).toBe('Verify your NFTopia account');
    });

    it('includes token in verification URL', async () => {
      await service.sendVerificationEmail('user@example.com', 'my-token');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('my-token');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends email with reset subject', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'reset-token', 'Bob');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toBe('Reset your NFTopia password');
    });

    it('includes reset token in email', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'reset-xyz');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('reset-xyz');
    });
  });

  describe('sendBidNotificationEmail', () => {
    it('sends bid notification with amount in subject area', async () => {
      await service.sendBidNotificationEmail('creator@example.com', 'auction-1', 150, 'Carol');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('creator@example.com');
      expect(call.subject).toBe('New bid on your NFT auction');
      expect(call.html).toContain('150');
    });
  });

  describe('sendAuctionWonEmail', () => {
    it('sends auction won email with NFT name in subject', async () => {
      await service.sendAuctionWonEmail('winner@example.com', 'auction-2', 'Cool NFT #42', 'Dave');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('winner@example.com');
      expect(call.subject).toContain('Cool NFT #42');
      expect(call.html).toContain('Cool NFT #42');
    });
  });

  describe('sendAsync', () => {
    it('calls the provided function asynchronously', async () => {
      const fn = jest.fn().mockResolvedValue(undefined);
      service.sendAsync(fn);
      await new Promise<void>((r) => setTimeout(r, 10));
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the function rejects', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('SMTP failure'));
      expect(() => service.sendAsync(fn)).not.toThrow();
      await new Promise<void>((r) => setTimeout(r, 10));
    });
  });

  describe('retry logic', () => {
    it('retries on transient failure and succeeds', async () => {
      mockSendMail
        .mockRejectedValueOnce(new Error('SMTP timeout'))
        .mockResolvedValueOnce({ messageId: 'retry-ok' });

      await service.sendVerificationEmail('user@example.com', 'token');
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries exhausted', async () => {
      mockSendMail.mockRejectedValue(new Error('Persistent failure'));

      await expect(
        service.sendVerificationEmail('user@example.com', 'token'),
      ).rejects.toThrow('Persistent failure');

      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });
  });

  describe('SendGrid provider', () => {
    it('configures SMTP transport pointing at sendgrid.net', async () => {
      jest.clearAllMocks();
      (fs.readFileSync as jest.Mock).mockReturnValue('<html></html>');
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const module2 = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: makeConfig({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'SG.key' }) },
        ],
      }).compile();

      const sgService = module2.get<EmailService>(EmailService);
      sgService.onModuleInit();

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.sendgrid.net' }),
      );
    });
  });

  describe('unknown provider', () => {
    it('does not configure a transporter and logs a warning', async () => {
      jest.clearAllMocks();
      (fs.readFileSync as jest.Mock).mockReturnValue('<html></html>');

      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      const module3 = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: makeConfig({ EMAIL_PROVIDER: 'unknown' }) },
        ],
      }).compile();

      const unknownService = module3.get<EmailService>(EmailService);
      unknownService.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
      expect(mockCreateTransport).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
