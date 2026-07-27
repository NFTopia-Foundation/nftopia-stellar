import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData, TemplateData } from '../email.interface';

/**
 * Email Queue Service
 * Responsible for adding email jobs to the queue
 */
@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @InjectQueue('email')
    private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  /**
   * Add an email job to the queue
   * @param templateName Template name
   * @param to Recipient email
   * @param subject Email subject
   * @param data Template data
   * @param priority Job priority (higher = more important)
   */
  async queueEmail(
    templateName: string,
    to: string,
    subject: string,
    data: TemplateData,
    priority: number = 0,
  ): Promise<void> {
    try {
      const job = await this.emailQueue.add(
        'send-email',
        {
          templateName,
          to,
          subject,
          data,
          priority,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority,
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      this.logger.log(
        `Email queued: job=${job.id} template=${templateName} to=${to}`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Queue verification email
   */
  async queueVerificationEmail(
    to: string,
    username: string,
    verificationUrl: string,
  ): Promise<void> {
    await this.queueEmail(
      'verification',
      to,
      'Verify Your NFTopia Email',
      {
        username,
        verificationUrl,
        expiryHours: 24,
      },
      10, // High priority
    );
  }

  /**
   * Queue password reset email
   */
  async queuePasswordResetEmail(
    to: string,
    username: string,
    resetUrl: string,
  ): Promise<void> {
    await this.queueEmail(
      'password-reset',
      to,
      'Reset Your NFTopia Password',
      {
        username,
        resetUrl,
        expiryHours: 1,
      },
      10, // High priority
    );
  }

  /**
   * Queue bid notification email
   */
  async queueBidNotificationEmail(
    to: string,
    username: string,
    nftName: string,
    bidderName: string,
    bidAmount: string,
    auctionUrl: string,
    collectionName?: string,
    auctionEndTime?: string,
  ): Promise<void> {
    await this.queueEmail(
      'bid-notification',
      to,
      `New Bid on ${nftName}`,
      {
        username,
        nftName,
        bidderName,
        bidAmount,
        auctionUrl,
        collectionName,
        auctionEndTime,
      },
      5, // Medium priority
    );
  }

  /**
   * Queue auction won email
   */
  async queueAuctionWonEmail(
    to: string,
    username: string,
    nftName: string,
    sellerName: string,
    winningAmount: string,
    nftUrl: string,
    collectionName?: string,
  ): Promise<void> {
    await this.queueEmail(
      'auction-won',
      to,
      `Congratulations! You Won ${nftName}`,
      {
        username,
        nftName,
        sellerName,
        winningAmount,
        nftUrl,
        collectionName,
      },
      8, // High priority
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.emailQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(): Promise<void> {
    await this.emailQueue.clean(24 * 60 * 60 * 1000, 100, 'completed');
    await this.emailQueue.clean(7 * 24 * 60 * 60 * 1000, 500, 'failed');
    this.logger.log('Cleaned old email jobs');
  }
}
