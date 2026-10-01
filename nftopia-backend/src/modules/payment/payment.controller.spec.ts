import { PaymentController } from './payment.controller';

describe('PaymentController', () => {
  let paymentService: {
    handleStripeWebhook: jest.Mock;
    getPaymentReceipt: jest.Mock;
  };
  let controller: PaymentController;

  beforeEach(() => {
    paymentService = {
      handleStripeWebhook: jest.fn().mockResolvedValue({ received: true }),
      getPaymentReceipt: jest.fn().mockResolvedValue({ transactionId: 1 }),
    };
    controller = new PaymentController(paymentService as never);
  });

  describe('stripeWebhook', () => {
    it('passes the raw body buffer and Stripe-Signature header through', async () => {
      const rawBody = Buffer.from('{"id":"evt_1"}');
      const req = {
        headers: { 'stripe-signature': 't=1,v1=abc' },
        body: rawBody,
      };

      const result = await controller.stripeWebhook(req as never);

      expect(paymentService.handleStripeWebhook).toHaveBeenCalledWith(
        rawBody,
        't=1,v1=abc',
      );
      expect(result).toEqual({ received: true });
    });

    it('passes undefined when the signature header is missing', async () => {
      const req = { headers: {}, body: Buffer.from('{}') };

      await controller.stripeWebhook(req as never);

      expect(paymentService.handleStripeWebhook).toHaveBeenCalledWith(
        expect.any(Buffer),
        undefined,
      );
    });

    it('falls back to an empty buffer if the body was never parsed as raw (misconfigured route)', async () => {
      const req = { headers: {}, body: { not: 'a buffer' } };

      await controller.stripeWebhook(req as never);

      const [rawBodyArg] = paymentService.handleStripeWebhook.mock.calls[0] as [
        Buffer,
      ];
      expect(Buffer.isBuffer(rawBodyArg)).toBe(true);
      expect(rawBodyArg.length).toBe(0);
    });
  });

  describe('getReceipt', () => {
    it('resolves the caller from the authenticated request', async () => {
      const req = { user: { userId: 'user-1' } };

      const result = await controller.getReceipt(42, req as never);

      expect(paymentService.getPaymentReceipt).toHaveBeenCalledWith(
        42,
        'user-1',
      );
      expect(result).toEqual({ transactionId: 1 });
    });
  });
});
