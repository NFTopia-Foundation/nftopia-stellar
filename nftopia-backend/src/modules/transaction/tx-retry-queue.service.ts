import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TxRetryJob, TxRetryStatus } from './entities/tx-retry-job.entity';
import { TransactionContractClient } from '../stellar/transaction-contract.client';

const BASE_DELAY_MS = 60_000; // 1 minute base

function exponentialDelay(attempt: number): number {
  const delays = [
    60_000,       // 1 min
    300_000,      // 5 min
    1_800_000,    // 30 min
    7_200_000,    // 2 h
    86_400_000,   // 24 h
  ];
  return delays[Math.min(attempt, delays.length - 1)] ?? BASE_DELAY_MS;
}

@Injectable()
export class TxRetryQueueService {
  private readonly logger = new Logger(TxRetryQueueService.name);

  constructor(
    @InjectRepository(TxRetryJob)
    private readonly retryRepo: Repository<TxRetryJob>,
    private readonly txContract: TransactionContractClient,
  ) {}

  async enqueue(
    transactionId: number,
    payload: Record<string, unknown>,
    maxAttempts = 5,
  ): Promise<TxRetryJob> {
    const job = this.retryRepo.create({
      transactionId,
      payload,
      maxAttempts,
      status: TxRetryStatus.PENDING,
      nextRetryAt: new Date(),
    });
    const saved = await this.retryRepo.save(job);
    this.logger.log(`Enqueued retry job ${saved.id} for transaction ${transactionId}`);
    return saved;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueJobs(): Promise<void> {
    const due = await this.retryRepo.find({
      where: {
        status: TxRetryStatus.PENDING,
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      order: { nextRetryAt: 'ASC' },
      take: 20,
    });

    if (due.length === 0) return;

    this.logger.log(`Processing ${due.length} due retry job(s)`);

    for (const job of due) {
      await this.processJob(job);
    }
  }

  async processJob(job: TxRetryJob): Promise<void> {
    job.status = TxRetryStatus.PROCESSING;
    job.attemptCount += 1;
    job.lastAttemptAt = new Date();
    await this.retryRepo.save(job);

    try {
      const { txId, maxGas, config } = job.payload as {
        txId: number;
        maxGas: number;
        config: Record<string, unknown>;
      };
      await this.txContract.executeTransaction(txId, maxGas, config);

      job.status = TxRetryStatus.SUCCESS;
      job.nextRetryAt = null;
      this.logger.log(
        `Retry job ${job.id} succeeded on attempt ${job.attemptCount}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.lastError = message;
      this.logger.warn(
        `Retry job ${job.id} attempt ${job.attemptCount} failed: ${message}`,
      );

      if (job.attemptCount >= job.maxAttempts) {
        job.status = TxRetryStatus.DEAD;
        job.nextRetryAt = null;
        this.logger.error(
          `Retry job ${job.id} is DEAD after ${job.attemptCount} attempts — manual intervention required`,
        );
      } else {
        job.status = TxRetryStatus.PENDING;
        job.nextRetryAt = new Date(
          Date.now() + exponentialDelay(job.attemptCount),
        );
      }
    }

    await this.retryRepo.save(job);
  }

  async getJobsForTransaction(transactionId: number): Promise<TxRetryJob[]> {
    return this.retryRepo.find({
      where: { transactionId },
      order: { createdAt: 'DESC' },
    });
  }

  async getDeadJobs(): Promise<TxRetryJob[]> {
    return this.retryRepo.find({
      where: { status: TxRetryStatus.DEAD },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
  }

  async requeueDeadJob(jobId: string): Promise<TxRetryJob> {
    const job = await this.retryRepo.findOneByOrFail({ id: jobId });
    if (job.status !== TxRetryStatus.DEAD) {
      throw new Error(`Job ${jobId} is not in DEAD state`);
    }
    job.status = TxRetryStatus.PENDING;
    job.nextRetryAt = new Date();
    job.attemptCount = 0;
    return this.retryRepo.save(job);
  }
}
