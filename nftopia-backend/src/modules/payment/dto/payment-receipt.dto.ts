import { TransactionState } from '../../transaction/enums/transaction-state.enum';
import { PaymentWebhookEventStatus } from '../entities/payment-webhook-event.entity';

export interface PaymentReceiptOrderSummary {
  id: string;
  status: string;
  type: string;
}

export interface PaymentReceiptWebhookEventSummary {
  id: string;
  eventType: string;
  status: PaymentWebhookEventStatus;
  receivedAt: Date;
}

/**
 * Read-model aggregating a payment's settlement state (Transaction, source
 * of truth), its marketplace order (Order, when one exists), and the
 * webhook deliveries that confirmed it — without this module owning a
 * competing notion of "payment status".
 */
export interface PaymentReceiptDto {
  transactionId: number;
  transactionState: TransactionState;
  amount: string;
  currency: string;
  paymentMethod?: string;
  buyerId?: string | null;
  sellerId?: string | null;
  order: PaymentReceiptOrderSummary | null;
  webhookEvents: PaymentReceiptWebhookEventSummary[];
}
