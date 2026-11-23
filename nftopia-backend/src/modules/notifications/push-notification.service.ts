import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';

export type PushSubscriptionJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
};

/**
 * Web push delivery (#661) — sibling to NotificationsService's WebSocket
 * toasts and email fallbacks, but reaches the user even while the tab is
 * closed/backgrounded, which neither of those can do.
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly vapidConfigured: boolean;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepo: Repository<PushSubscription>,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>(
      'VAPID_SUBJECT',
      'mailto:support@nftopia.example',
    );

    this.vapidConfigured = Boolean(publicKey && privateKey);
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    } else {
      this.logger.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not configured — push notifications are disabled.',
      );
    }
  }

  async subscribe(
    userId: string,
    subscription: PushSubscriptionJson,
  ): Promise<void> {
    const existing = await this.subscriptionRepo.findOne({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      existing.userId = userId;
      existing.p256dh = subscription.keys.p256dh;
      existing.auth = subscription.keys.auth;
      await this.subscriptionRepo.save(existing);
      return;
    }

    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }),
    );
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.subscriptionRepo.delete({ endpoint });
  }

  /**
   * Sends a push notification to every subscription the user has (one per
   * browser/device they opted in from). Never throws — a delivery failure
   * for one subscriber must not take down the caller's event handler, and a
   * subscription the push service reports as gone (410/404) is pruned so it
   * stops being retried.
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    if (!this.vapidConfigured) return;

    const subscriptions = await this.subscriptionRepo.find({
      where: { userId },
    });

    await Promise.all(
      subscriptions.map((subscription) => this.deliver(subscription, payload)),
    );
  }

  private async deliver(
    subscription: PushSubscription,
    payload: PushNotificationPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await this.subscriptionRepo.delete({ id: subscription.id });
        this.logger.debug(
          `Pruned expired push subscription ${subscription.id} (status ${statusCode})`,
        );
        return;
      }

      this.logger.error(
        `Push delivery failed for subscription ${subscription.id}: ${(err as Error).message}`,
      );
    }
  }
}
