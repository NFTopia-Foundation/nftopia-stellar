import { ConflictException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentService } from './payment.service';
import { TransactionState } from '../transaction/enums/transaction-state.enum';

const STRIPE_SECRET_KEY = 'sk_test_dummy';
const STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';

function makeSignedPayload(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  });
  return { rawBody: Buffer.from(payload), signature };
}

function makePaymentIntentEvent(
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed',
  overrides: { id?: string; paymentIntentId?: string } = {},
) {
  return {
    id: overrides.id ?? 'evt_1',
    type,
    data: { object: { id: overrides.paymentIntentId ?? 'pi_1' } },
  };
}

describe('PaymentService', () => {
  let webhookEventRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let orderRepo: { findOne: jest.Mock };
  let transactionService: {
    confirmOffchainPayment: jest.Mock;
    findById: jest.Mock;
  };
  let service: PaymentService;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;

    webhookEventRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: unknown) => data),
      save: jest
        .fn()
        .mockImplementation((data: unknown) => Promise.resolve(data)),
    };
    orderRepo = { findOne: jest.fn().mockResolvedValue(null) };
    transactionService = {
      confirmOffchainPayment: jest.fn(),
      findById: jest.fn(),
    };

    service = new PaymentService(
      webhookEventRepo as never,
      orderRepo as never,
      transactionService as never,
    );
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  describe('handleStripeWebhook', () => {
    it('rejects when Stripe is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const unconfigured = new PaymentService(
        webhookEventRepo as never,
        orderRepo as never,
        transactionService as never,
      );

      await expect(
        unconfigured.handleStripeWebhook(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow('Stripe webhook processing is not configured');
    });

    it('rejects a request with no Stripe-Signature header', async () => {
      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), undefined),
      ).rejects.toThrow('Missing Stripe-Signature header');
    });

    it('rejects a payload whose signature does not verify', async () => {
      await expect(
        service.handleStripeWebhook(
          Buffer.from('{"id":"evt_1"}'),
          'bad-signature',
        ),
      ).rejects.toThrow(/Invalid Stripe webhook signature/);
    });

    it('confirms the matching transaction on payment_intent.succeeded', async () => {
      const { rawBody, signature } = makeSignedPayload(
        makePaymentIntentEvent('payment_intent.succeeded', {
          id: 'evt_success',
          paymentIntentId: 'pi_abc',
        }),
      );
      transactionService.confirmOffchainPayment.mockResolvedValue({ id: 42 });

      const result = await service.handleStripeWebhook(rawBody, signature);

      expect(result).toEqual({ received: true });
      expect(transactionService.confirmOffchainPayment).toHaveBeenCalledWith(
        'pi_abc',
        'succeeded',
        expect.objectContaining({ stripeEventId: 'evt_success' }),
      );
      expect(webhookEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processed',
          providerEventId: 'evt_success',
          transactionId: 42,
        }),
      );
    });

    it('confirms failure on payment_intent.payment_failed', async () => {
      const { rawBody, signature } = makeSignedPayload(
        makePaymentIntentEvent('payment_intent.payment_failed', {
          id: 'evt_failed',
          paymentIntentId: 'pi_xyz',
        }),
      );
      transactionService.confirmOffchainPayment.mockResolvedValue({ id: 7 });

      await service.handleStripeWebhook(rawBody, signature);

      expect(transactionService.confirmOffchainPayment).toHaveBeenCalledWith(
        'pi_xyz',
        'failed',
        expect.anything(),
      );
    });

    it('ignores (but records) an event type it does not act on', async () => {
      const { rawBody, signature } = makeSignedPayload({
        id: 'evt_other',
        type: 'charge.refunded',
        data: { object: { id: 'ch_1' } },
      });

      await service.handleStripeWebhook(rawBody, signature);

      expect(transactionService.confirmOffchainPayment).not.toHaveBeenCalled();
      expect(webhookEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ignored',
          providerEventId: 'evt_other',
        }),
      );
    });

    it('is idempotent: a redelivered event ID is a no-op', async () => {
      webhookEventRepo.findOne.mockResolvedValue({
        providerEventId: 'evt_dup',
      });
      const { rawBody, signature } = makeSignedPayload(
        makePaymentIntentEvent('payment_intent.succeeded', { id: 'evt_dup' }),
      );

      const result = await service.handleStripeWebhook(rawBody, signature);

      expect(result).toEqual({ received: true });
      expect(transactionService.confirmOffchainPayment).not.toHaveBeenCalled();
      expect(webhookEventRepo.save).not.toHaveBeenCalled();
    });

    it('records and acknowledges (does not throw) when no transaction matches the payment intent', async () => {
      const { rawBody, signature } = makeSignedPayload(
        makePaymentIntentEvent('payment_intent.succeeded', {
          id: 'evt_missing',
        }),
      );
      transactionService.confirmOffchainPayment.mockRejectedValue(
        new NotFoundException('Transaction not found for payment intent: pi_1'),
      );

      const result = await service.handleStripeWebhook(rawBody, signature);

      expect(result).toEqual({ received: true });
      expect(webhookEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          providerEventId: 'evt_missing',
        }),
      );
    });

    it('records and acknowledges when the transaction was already confirmed (conflict)', async () => {
      const { rawBody, signature } = makeSignedPayload(
        makePaymentIntentEvent('payment_intent.succeeded', {
          id: 'evt_conflict',
        }),
      );
      transactionService.confirmOffchainPayment.mockRejectedValue(
        new ConflictException('Transaction 1 is already completed'),
      );

      await expect(
        service.handleStripeWebhook(rawBody, signature),
      ).resolves.toEqual({ received: true });
    });

    it('records the failure and rethrows on an unexpected (retryable) error', async () => {
      const { rawBody, signature } = makeSignedPayload(
        makePaymentIntentEvent('payment_intent.succeeded', {
          id: 'evt_db_down',
        }),
      );
      transactionService.confirmOffchainPayment.mockRejectedValue(
        new Error('connection to database lost'),
      );

      await expect(
        service.handleStripeWebhook(rawBody, signature),
      ).rejects.toThrow('connection to database lost');
      expect(webhookEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          providerEventId: 'evt_db_down',
        }),
      );
    });
  });

  describe('getPaymentReceipt', () => {
    it('aggregates transaction, order, and webhook history', async () => {
      transactionService.findById.mockResolvedValue({
        id: 42,
        state: TransactionState.COMPLETED,
        amount: '100.0000000',
        currency: 'USD',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        metadata: { listingId: 'listing-1', paymentMethod: 'STRIPE' },
      });
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: 'COMPLETED',
        type: 'PURCHASE',
      });
      webhookEventRepo.find.mockResolvedValue([
        {
          id: 'evt-row-1',
          eventType: 'payment_intent.succeeded',
          status: 'processed',
          receivedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      const receipt = await service.getPaymentReceipt(42, 'buyer-1');

      expect(transactionService.findById).toHaveBeenCalledWith(42, 'buyer-1');
      expect(orderRepo.findOne).toHaveBeenCalledWith({
        where: { listingId: 'listing-1' },
      });
      expect(receipt).toEqual({
        transactionId: 42,
        transactionState: TransactionState.COMPLETED,
        amount: '100.0000000',
        currency: 'USD',
        paymentMethod: 'STRIPE',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        order: { id: 'order-1', status: 'COMPLETED', type: 'PURCHASE' },
        webhookEvents: [
          {
            id: 'evt-row-1',
            eventType: 'payment_intent.succeeded',
            status: 'processed',
            receivedAt: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      });
    });

    it('returns order: null when the transaction has no correlated listing', async () => {
      transactionService.findById.mockResolvedValue({
        id: 1,
        state: TransactionState.COMPLETED,
        amount: '1',
        currency: 'XLM',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        metadata: {},
      });

      const receipt = await service.getPaymentReceipt(1, 'buyer-1');

      expect(orderRepo.findOne).not.toHaveBeenCalled();
      expect(receipt.order).toBeNull();
    });

    it('propagates access-control errors from TransactionService.findById unchanged', async () => {
      transactionService.findById.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await expect(
        service.getPaymentReceipt(999, 'buyer-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
