import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { EmailModule } from '../email/email.module';
import { PushSubscription } from './entities/push-subscription.entity';
import { PushNotificationService } from './push-notification.service';
import { PushNotificationController } from './push-notification.controller';

/**
 * NotificationsModule
 *
 * Provides the authenticated WebSocket gateway (`/notifications` namespace)
 * and the `NotificationsService` helper that other modules can inject to
 * push real-time events to users.
 *
 * ### Usage
 * Import this module into any feature module that needs real-time push:
 *
 * ```ts
 * @Module({
 *   imports: [NotificationsModule],
 *   providers: [MyService],
 * })
 * export class MyModule {}
 * ```
 *
 * Then inject `NotificationsService`:
 *
 * ```ts
 * constructor(private readonly notifications: NotificationsService) {}
 *
 * // Toast to a specific user:
 * this.notifications.notifyUser(sellerId, 'bid.received', 'New Bid', 'User X bid 150 XLM');
 *
 * // Broadcast auction price update:
 * this.notifications.broadcastBidUpdate(auctionId, { ... });
 * ```
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    }),
    ScheduleModule.forRoot(),
    EmailModule,
    TypeOrmModule.forFeature([PushSubscription]),
  ],
  controllers: [PushNotificationController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    PushNotificationService,
  ],
  exports: [NotificationsService, PushNotificationService],
})
export class NotificationsModule {}
