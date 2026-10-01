import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PaymentWebhookEventStatus = 'processed' | 'ignored' | 'failed';

/**
 * Audit trail of processed payment-gateway webhook deliveries (#532).
 *
 * This is *not* a competing record of payment/settlement state — that
 * remains owned by `Transaction` (on-chain and off-chain settlement) and
 * `Order` (marketplace order records). What neither of those tracks is
 * "which gateway events have we already processed", which is exactly what
 * a webhook consumer needs for idempotency: a provider (Stripe) may
 * deliver the same event more than once, and `providerEventId` being
 * unique is what makes re-delivery a safe no-op instead of double-applying
 * a payment confirmation.
 */
@Entity('payment_webhook_events')
@Index('idx_payment_webhook_events_provider_event_id', ['providerEventId'], {
  unique: true,
})
@Index('idx_payment_webhook_events_transaction_id', ['transactionId'])
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. 'stripe'. Kept as a plain string rather than an enum so a future
   * provider doesn't need a migration to add. */
  @Column({ type: 'varchar', length: 30 })
  provider: string;

  /** The gateway's own event ID (Stripe's `event.id`) — unique so a
   * redelivered webhook is a safe no-op. */
  @Column({ type: 'varchar', length: 255 })
  providerEventId: string;

  /** e.g. 'payment_intent.succeeded'. */
  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentIntentId?: string;

  /** The Transaction this event resolved to, when applicable. */
  @Column({ type: 'int', nullable: true })
  transactionId?: number;

  @Column({ type: 'varchar', length: 20 })
  status: PaymentWebhookEventStatus;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt: Date;
}
