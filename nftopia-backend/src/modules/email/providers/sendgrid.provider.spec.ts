import { SendGridProvider } from './sendgrid.provider';

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

describe('SendGridProvider', () => {
  let provider: SendGridProvider;

  beforeEach(() => {
    provider = new SendGridProvider('SG.test-api-key', 'noreply@nftopia.com');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send email successfully via SendGrid', async () => {
      await expect(
        provider.send({
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
          text: 'Test',
        }),
      ).resolves.not.toThrow();
    });

    it('should send to multiple recipients', async () => {
      await expect(
        provider.send({
          to: ['a@example.com', 'b@example.com'],
          subject: 'Test Subject',
          html: '<p>Test</p>',
        }),
      ).resolves.not.toThrow();
    });

    it('should throw on send failure', async () => {
      const sgMail = require('@sendgrid/mail');
      sgMail.send.mockRejectedValueOnce(new Error('SendGrid API error'));

      await expect(
        provider.send({
          to: 'recipient@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow('SendGrid API error');
    });
  });

  describe('verify', () => {
    it('should return true when API key is set', async () => {
      const result = await provider.verify();
      expect(result).toBe(true);
    });

    it('should return false when API key is empty', async () => {
      const emptyProvider = new SendGridProvider('', 'noreply@nftopia.com');
      const result = await emptyProvider.verify();
      expect(result).toBe(false);
    });
  });
});
