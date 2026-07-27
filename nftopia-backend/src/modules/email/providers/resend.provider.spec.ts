import { ResendProvider } from './resend.provider';

// Mock the Resend SDK
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'resend-test-id' } }),
    },
  })),
}));

describe('ResendProvider', () => {
  let provider: ResendProvider;

  beforeEach(() => {
    provider = new ResendProvider('re_test-api-key', 'noreply@nftopia.com');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send email successfully via Resend', async () => {
      await expect(
        provider.send({
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
          text: 'Test',
        }),
      ).resolves.not.toThrow();
    });

    it('should send to array of recipients', async () => {
      await expect(
        provider.send({
          to: ['a@example.com', 'b@example.com'],
          subject: 'Test Subject',
          html: '<p>Test</p>',
        }),
      ).resolves.not.toThrow();
    });

    it('should throw on send failure', async () => {
      const { Resend } = require('resend');
      const mockInstance = new Resend();
      mockInstance.emails.send.mockRejectedValueOnce(new Error('Resend API error'));

      // Create provider with mocked client
      const failProvider = new ResendProvider('re_fail-key', 'noreply@nftopia.com');
      (failProvider as any).client = mockInstance;

      await expect(
        failProvider.send({
          to: 'recipient@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow('Resend API error');
    });
  });

  describe('verify', () => {
    it('should return true when API key is set', async () => {
      const result = await provider.verify();
      expect(result).toBe(true);
    });

    it('should return false when API key is empty', async () => {
      const emptyProvider = new ResendProvider('', 'noreply@nftopia.com');
      const result = await emptyProvider.verify();
      expect(result).toBe(false);
    });
  });
});
