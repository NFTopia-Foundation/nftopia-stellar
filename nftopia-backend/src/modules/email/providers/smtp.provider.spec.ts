import { SmtpProvider } from './smtp.provider';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

describe('SmtpProvider', () => {
  let provider: SmtpProvider;

  beforeEach(() => {
    provider = new SmtpProvider(
      'smtp.test.com',
      587,
      'testuser',
      'testpass',
      false,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      await expect(
        provider.send({
          to: 'recipient@example.com',
          from: '"NFTopia" <noreply@nftopia.com>',
          subject: 'Test Subject',
          html: '<p>Test</p>',
          text: 'Test',
        }),
      ).resolves.not.toThrow();
    });

    it('should throw on send failure', async () => {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport();
      transporter.sendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const failProvider = new SmtpProvider('bad-host', 587, '', '', false);

      // Re-mock for the bad provider
      jest.spyOn(failProvider as any, 'transporter', 'get').mockReturnValue({
        sendMail: jest.fn().mockRejectedValueOnce(new Error('SMTP connection failed')),
        verify: jest.fn(),
      });

      await expect(
        failProvider.send({
          to: 'recipient@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow();
    });
  });

  describe('verify', () => {
    it('should verify configuration successfully', async () => {
      const result = await provider.verify();
      expect(result).toBe(true);
    });
  });
});
