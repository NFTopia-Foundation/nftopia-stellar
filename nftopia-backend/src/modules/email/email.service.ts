import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog, EmailStatus, EmailType } from './entities/email-log.entity';
import { EmailTemplateService } from './template.service';
import {
  EMAIL_QUEUE_NAME,
  SEND_EMAIL_JOB,
} from './interfaces/email-job.interface';
import { getEmailConfig } from './email.config';

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: true,
  removeOnFail: false,
};

/**
 * Public entry point for sending transactional email. Every method renders
 * the relevant Handlebars template, writes a queued EmailLog row, and
 * enqueues a Bull job for the EmailProcessor to deliver asynchronously —
 * callers never block on the network round-trip to the email provider.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectQueue(EMAIL_QUEUE_NAME) private readonly emailQueue: Queue,
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    private readonly templateService: EmailTemplateService,
  ) {
    this.frontendUrl = getEmailConfig(process.env).frontendUrl;
  }

  async sendVerificationEmail(
    to: string,
    token: string,
    username?: string,
  ): Promise<void> {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const { html, text } = this.templateService.render('verification-email', {
      username: username || 'there',
      verificationUrl,
    });

    await this.enqueue(
      EmailType.VERIFICATION,
      to,
      'Verify your NFTopia email address',
      html,
      text,
      {},
    );
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    username?: string,
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const { html, text } = this.templateService.render('password-reset', {
      username: username || 'there',
      resetUrl,
    });

    await this.enqueue(
      EmailType.PASSWORD_RESET,
      to,
      'Reset your NFTopia password',
      html,
      text,
      {},
    );
  }

  async sendBidNotificationEmail(
    to: string,
    auctionId: string,
    amount: number,
    username?: string,
  ): Promise<void> {
    const auctionUrl = `${this.frontendUrl}/auctions/${auctionId}`;
    const { html, text } = this.templateService.render('bid-notification', {
      username: username || 'there',
      auctionId,
      amount: amount.toFixed(2),
      auctionUrl,
    });

    await this.enqueue(
      EmailType.BID_NOTIFICATION,
      to,
      'New bid on your auction',
      html,
      text,
      { auctionId, amount },
    );
  }

  async sendAccountDeletionEmail(
    to: string,
    token: string,
    username?: string,
  ): Promise<void> {
    const confirmationUrl = `${this.frontendUrl}/account/delete?token=${encodeURIComponent(token)}`;
    const { html, text } = this.templateService.render('account-deletion', {
      username: username || 'there',
      confirmationUrl,
      token,
    });

    await this.enqueue(
      EmailType.ACCOUNT_DELETION,
      to,
      'Confirm your NFTopia account deletion',
      html,
      text,
      {},
    );
  }

  async sendAuctionWonEmail(
    to: string,
    auctionId: string,
    nftName: string,
    username?: string,
  ): Promise<void> {
    const auctionUrl = `${this.frontendUrl}/auctions/${auctionId}`;
    const { html, text } = this.templateService.render('auction-won', {
      username: username || 'there',
      auctionId,
      nftName,
      auctionUrl,
    });

    await this.enqueue(
      EmailType.AUCTION_WON,
      to,
      `You won ${nftName}!`,
      html,
      text,
      { auctionId, nftName },
    );
  }

  private async enqueue(
    type: EmailType,
    to: string,
    subject: string,
    html: string,
    text: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const log = await this.emailLogRepo.save(
      this.emailLogRepo.create({
        to,
        subject,
        type,
        status: EmailStatus.QUEUED,
        metadata,
      }),
    );

    try {
      await this.emailQueue.add(
        SEND_EMAIL_JOB,
        { logId: log.id, to, subject, html, text, type },
        DEFAULT_JOB_OPTIONS,
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(
        `Failed to enqueue email to=${to} type=${type}: ${message}`,
      );
      await this.emailLogRepo.update(log.id, {
        status: EmailStatus.FAILED,
        error: message,
      });
    }
  }
}
