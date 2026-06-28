import { Injectable, Logger } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import {
  BID_UPDATE_EVENT,
  NOTIFICATION_EVENT,
  auctionRoom,
  userRoom,
  type BidUpdatePayload,
  type NotificationPayload,
} from './interfaces/notification.interface';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly emailService: EmailService,
  ) {}

  notifyUser(
    userId: string,
    type: string,
    title: string,
    message?: string,
    data?: Record<string, unknown>,
  ): void {
    const payload: NotificationPayload = {
      id: this.generateId(),
      type,
      title,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    this.gateway
      .getServer()
      .to(userRoom(userId))
      .emit(NOTIFICATION_EVENT, payload);

    this.logger.debug(`[notify] user=${userId} type=${type} title="${title}"`);
  }

  broadcastBidUpdate(auctionId: string, payload: BidUpdatePayload): void {
    this.gateway
      .getServer()
      .to(auctionRoom(auctionId))
      .emit(BID_UPDATE_EVENT, payload);

    this.logger.debug(
      `[bid_update] auction=${auctionId} amount=${payload.amountXlm} XLM bidder=${payload.bidderId}`,
    );
  }

  notifyBidEmail(
    recipientEmail: string,
    auctionId: string,
    amount: number,
    username?: string,
  ): void {
    this.emailService.sendAsync(() =>
      this.emailService.sendBidNotificationEmail(
        recipientEmail,
        auctionId,
        amount,
        username,
      ),
    );
    this.logger.debug(
      `[bid_email] to=${recipientEmail} auction=${auctionId} amount=${amount}`,
    );
  }

  notifyAuctionWonEmail(
    recipientEmail: string,
    auctionId: string,
    nftName: string,
    username?: string,
  ): void {
    this.emailService.sendAsync(() =>
      this.emailService.sendAuctionWonEmail(
        recipientEmail,
        auctionId,
        nftName,
        username,
      ),
    );
    this.logger.debug(
      `[auction_won_email] to=${recipientEmail} auction=${auctionId} nft="${nftName}"`,
    );
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
