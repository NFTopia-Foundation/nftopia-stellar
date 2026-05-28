import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

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
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    }),
  ],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
