import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { TransactionService } from '../transaction/transaction.service';
import { Order } from '../order/entities/order.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { getPaymentConfig, PaymentConfig } from './payment.config';
import { PaymentReceiptDto } from './dto/payment-receipt.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly config: PaymentConfig;
  private readonly stripe?: Stripe;

  constructor(
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventRepo: Repository<PaymentWebhookEvent>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly transactionService: TransactionService,
  ) {
    this.config = getPaymentConfig(process.env);
    this.stripe = this.config.stripeSecretKey
      ? new Stripe(this.config.stripeSecretKey)
      : undefined;
  }

  /**
   * Verifies and processes a Stripe webhook delivery, confirming (or
   * failing) the matching off-chain payment via
   * `TransactionService.confirmOffchainPayment`.
   *
   * `rawBody` must be the exact, unparsed request body bytes — Stripe's
   * signature is computed over the raw payload, so a re-serialized JSON
   * body will not verify even if its contents are identical.
   */
  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!this.config.stripeConfigured || !this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe webhook processing is not configured',
      );
    }

    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.stripeWebhookSecret!,
      );
    } catch (error) {
      throw new BadRequestException(
        `Invalid Stripe webhook signature: ${(error as Error).message}`,
      );
    }

    // Idempotency: Stripe may redeliver the same event (retries, or a
    // duplicate send). Treat a repeat as an already-handled no-op rather
    // than re-confirming (and potentially re-executing) the transaction.
    const alreadyProcessed = await this.webhookEventRepo.findOne({
      where: { providerEventId: event.id },
    });
    if (alreadyProcessed) {
      this.logger.log(`Ignoring redelivered Stripe event ${event.id}`);
      return { received: true };
    }

    await this.processStripeEvent(event);
    return { received: true };
  }

  private async processStripeEvent(event: Stripe.Event): Promise<void> {
    const relevantTypes = new Set([
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
    ]);

    if (!relevantTypes.has(event.type)) {
      await this.recordWebhookEvent(event, { status: 'ignored' });
      return;
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      const transaction = await this.transactionService.confirmOffchainPayment(
        paymentIntent.id,
        event.type === 'payment_intent.succeeded' ? 'succeeded' : 'failed',
        { stripeEventId: event.id },
      );

      await this.recordWebhookEvent(event, {
        status: 'processed',
        paymentIntentId: paymentIntent.id,
        transactionId: transaction.id,
      });
    } catch (error) {
      // NotFoundException (no transaction matches this payment intent, e.g.
      // an event from an unrelated Stripe account/test mode) and
      // ConflictException (already confirmed — a legitimate race with
      // another delivery, since we only dedupe on *this* provider event's
      // ID) are not retryable: record and acknowledge so Stripe stops
      // resending. Anything else is unexpected (DB down, etc.) — record
      // what we can, then rethrow so Stripe's automatic retry eventually
      // succeeds once whatever failed recovers.
      const notRetryable =
        error instanceof NotFoundException ||
        error instanceof ConflictException;

      await this.recordWebhookEvent(event, {
        status: 'failed',
        paymentIntentId: paymentIntent.id,
        errorMessage: (error as Error).message,
      });

      if (!notRetryable) {
        throw error;
      }

      this.logger.warn(
        `Stripe event ${event.id} not retryable: ${(error as Error).message}`,
      );
    }
  }

  private async recordWebhookEvent(
    event: Stripe.Event,
    fields: {
      status: 'processed' | 'ignored' | 'failed';
      paymentIntentId?: string;
      transactionId?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    await this.webhookEventRepo.save(
      this.webhookEventRepo.create({
        provider: 'stripe',
        providerEventId: event.id,
        eventType: event.type,
        payload: event as unknown as Record<string, unknown>,
        ...fields,
      }),
    );
  }

  /**
   * Aggregates a payment receipt for `transactionId` from Transaction
   * (settlement state, source of truth), Order (marketplace record, when
   * one exists for the same listing), and this module's own webhook
   * history — without introducing a competing "payment status" of its
   * own. Access control is delegated to
   * `TransactionService.findById`'s existing buyer/seller check.
   */
  async getPaymentReceipt(
    transactionId: number,
    userId: string,
  ): Promise<PaymentReceiptDto> {
    const transaction = await this.transactionService.findById(
      transactionId,
      userId,
    );

    const listingId =
      typeof transaction.metadata?.listingId === 'string'
        ? transaction.metadata.listingId
        : undefined;
    const paymentMethod =
      typeof transaction.metadata?.paymentMethod === 'string'
        ? transaction.metadata.paymentMethod
        : undefined;

    const order = listingId
      ? await this.orderRepo.findOne({ where: { listingId } })
      : null;

    const webhookEvents = await this.webhookEventRepo.find({
      where: { transactionId },
      order: { receivedAt: 'ASC' },
    });

    return {
      transactionId: transaction.id,
      transactionState: transaction.state,
      amount: transaction.amount,
      currency: transaction.currency,
      paymentMethod,
      buyerId: transaction.buyerId,
      sellerId: transaction.sellerId,
      order: order
        ? { id: order.id, status: order.status, type: order.type }
        : null,
      webhookEvents: webhookEvents.map((webhookEvent) => ({
        id: webhookEvent.id,
        eventType: webhookEvent.eventType,
        status: webhookEvent.status,
        receivedAt: webhookEvent.receivedAt,
      })),
    };
  }
}
