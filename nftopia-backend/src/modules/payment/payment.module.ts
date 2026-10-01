import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { Order } from '../order/entities/order.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TransactionModule } from '../transaction/transaction.module';

// See docs/payment-module.md for the scope decision this module
// implements (#532): a thin orchestration + webhook-ingestion +
// read-aggregation layer over Transaction (settlement state) and Order
// (marketplace records) — not a third, competing payment-state owner.
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentWebhookEvent, Order]),
    TransactionModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
