import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PaymentService } from './payment.service';

type AuthRequest = ExpressRequest & { user?: { userId?: string } };

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Stripe calls this directly — no JWT to authenticate with, so this
   * route intentionally has no guard. Authenticity instead comes from
   * verifying the Stripe-Signature header inside PaymentService against
   * the raw request body (see the `raw()` body-parser scoped to this exact
   * path in main.ts — Stripe's signature won't verify against a
   * re-serialized JSON body, so this route needs the untouched bytes, not
   * `@Body()`).
   */
  @Post('webhooks/stripe')
  async stripeWebhook(@Req() req: ExpressRequest) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const rawBody: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from('');
    return this.paymentService.handleStripeWebhook(rawBody, signature);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':transactionId/receipt')
  async getReceipt(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.paymentService.getPaymentReceipt(transactionId, userId);
  }
}
