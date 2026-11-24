import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PushNotificationService } from './push-notification.service';
import {
  PushSubscribeDto,
  PushUnsubscribeDto,
} from './dto/push-subscription.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; [key: string]: unknown };
}

/**
 * Web push opt-in endpoints (#661), consumed by
 * nftopia-frontend/lib/push-notifications.ts.
 */
@Controller('notifications/push')
@UseGuards(JwtAuthGuard)
export class PushNotificationController {
  constructor(private readonly pushService: PushNotificationService) {}

  @Post('subscribe')
  async subscribe(
    @Request() req: AuthenticatedRequest,
    @Body() dto: PushSubscribeDto,
  ) {
    await this.pushService.subscribe(req.user.userId, dto);
    return { success: true };
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() dto: PushUnsubscribeDto) {
    await this.pushService.unsubscribe(dto.endpoint);
    return { success: true };
  }
}
