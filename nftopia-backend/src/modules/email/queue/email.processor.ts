import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailJobData, EmailStatus } from '../email.interface';
import { EmailService } from '../email.service';
import { EmailLog } from '../entities/email-log.entity';

/**
 * Email Queue Processor
 * Processes email jobs from the BullMQ queue with retry and exponential backoff.
 *
 * Each job creates/updates an EmailLog entry to track delivery status.
 * On failure the job is re-thrown so BullMQ applies its retry policy.
 */
@Processor('email', {
  concurrency: 5,
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { templateName, to, subject, data } = job.data;

    this.logger.log(
      `Processing email job ${job.id}: template=${templateName} to=${to}`,
    );

    // Upsert the email log for this job
    const emailLog = await this.upsertEmailLog(
      String(job.id),
      Array.isArray(to) ? to.join(', ') : to,
      subject,
      templateName,
    );

    try {
      emailLog.status = EmailStatus.PROCESSING;
      emailLog.attemptCount += 1;
      await this.emailLogRepository.save(emailLog);

      // Delegate to EmailService — raw send (no double-logging, processor owns the log)
      await this.emailService.sendRaw(to, templateName, subject, data);

      emailLog.status = EmailStatus.SENT;
      emailLog.sentAt = new Date();
      emailLog.errorMessage = null;
      await this.emailLogRepository.save(emailLog);

      this.logger.log(`Email job ${job.id} completed successfully`);
    } catch (error) {
      const maxAttempts = (job.opts.attempts as number) ?? 3;
      const attemptsUsed = (job.attemptsMade as number) ?? 0;

      emailLog.status =
        attemptsUsed < maxAttempts ? EmailStatus.RETRYING : EmailStatus.FAILED;
      emailLog.errorMessage = (error as Error).message;
      await this.emailLogRepository.save(emailLog);

      this.logger.error(
        `Email job ${job.id} failed (attempt ${attemptsUsed + 1}/${maxAttempts}): ${(error as Error).message}`,
      );

      // Re-throw so BullMQ applies backoff + retry
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(
      `Job ${job.id} completed after ${job.attemptsMade} attempt(s)`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} permanently failed after ${job.attemptsMade} attempt(s): ${error.message}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is now active`);
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private async upsertEmailLog(
    jobId: string,
    to: string,
    subject: string,
    template: string,
  ): Promise<EmailLog> {
    const existing = await this.emailLogRepository.findOne({ where: { jobId } });
    if (existing) {
      return existing;
    }

    const log = this.emailLogRepository.create({
      jobId,
      to,
      subject,
      template,
      provider: process.env.EMAIL_PROVIDER ?? 'smtp',
      status: EmailStatus.PENDING,
      attemptCount: 0,
    });

    return this.emailLogRepository.save(log);
  }
}
