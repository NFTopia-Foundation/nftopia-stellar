import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionState } from './enums/transaction-state.enum';
import { TransactionContractClient } from '../stellar/transaction-contract.client';
import { TransactionService } from './transaction.service';
import { DistributedLockService } from '../../common/locks/distributed-lock.service';
import { AuditService } from '../../common/audit/audit.service';
import { PrometheusService } from '../../common/metrics/prometheus';

export const RECONCILIATION_LOCK_KEY = 'lock:transaction-reconciliation';
export const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_STALE_AGE_SECONDS = 600; // 10 minutes
export const DEFAULT_BATCH_SIZE = 100;

@Injectable()
export class TransactionReconciliationJob {
  private readonly logger = new Logger(TransactionReconciliationJob.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly txContract: TransactionContractClient,
    private readonly lockService: DistributedLockService,
    private readonly configService: ConfigService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
    private readonly prometheus: PrometheusService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleReconciliation(): Promise<void> {
    this.logger.log('Starting scheduled transaction reconciliation job...');

    const lockTtlMs = Number(
      this.configService.get<string | number>(
        'TRANSACTION_RECONCILIATION_LOCK_TTL_MS',
      ) ?? DEFAULT_LOCK_TTL_MS,
    );

    const lockToken = await this.lockService.acquire(
      RECONCILIATION_LOCK_KEY,
      lockTtlMs,
    );

    if (!lockToken) {
      this.logger.log(
        'Transaction reconciliation is currently running on another instance; skipping run.',
      );
      return;
    }

    try {
      await this.reconcileStaleTransactions();
    } catch (err) {
      this.logger.error(
        `Unexpected error during transaction reconciliation: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      await this.lockService.release(RECONCILIATION_LOCK_KEY, lockToken);
      this.logger.log(
        'Completed transaction reconciliation run and released lock.',
      );
    }
  }

  async reconcileStaleTransactions(): Promise<{
    examined: number;
    corrected: number;
    untouched: number;
  }> {
    const staleAgeSeconds = Number(
      this.configService.get<string | number>(
        'TRANSACTION_RECONCILIATION_STALE_AGE_SECONDS',
      ) ?? DEFAULT_STALE_AGE_SECONDS,
    );
    const batchSize = Number(
      this.configService.get<string | number>(
        'TRANSACTION_RECONCILIATION_BATCH_SIZE',
      ) ?? DEFAULT_BATCH_SIZE,
    );

    const nowSeconds = Math.floor(Date.now() / 1000);
    const cutoffSeconds = nowSeconds - staleAgeSeconds;

    const nonFinalStates = [
      TransactionState.PENDING,
      TransactionState.PENDING_RETRY,
      TransactionState.EXECUTING,
      TransactionState.DRAFT,
    ];

    const staleTransactions = await this.transactionRepo.find({
      where: {
        state: In(nonFinalStates),
        createdAt: LessThanOrEqual(cutoffSeconds),
      },
      order: { createdAt: 'ASC' },
      take: batchSize,
    });

    if (staleTransactions.length === 0) {
      this.logger.log('No stale non-final transactions to reconcile.');
      return { examined: 0, corrected: 0, untouched: 0 };
    }

    this.logger.log(
      `Found ${staleTransactions.length} stale non-final transactions older than ${staleAgeSeconds}s. Reconciling...`,
    );

    let correctedCount = 0;
    let untouchedCount = 0;

    for (const tx of staleTransactions) {
      const outcome = await this.reconcileSingleTransaction(tx);
      if (outcome.corrected) {
        correctedCount++;
      } else {
        untouchedCount++;
      }
    }

    this.logger.log(
      `Reconciliation cycle finished: examined ${staleTransactions.length}, corrected ${correctedCount}, untouched ${untouchedCount}.`,
    );

    return {
      examined: staleTransactions.length,
      corrected: correctedCount,
      untouched: untouchedCount,
    };
  }

  async reconcileSingleTransaction(
    transaction: Transaction,
  ): Promise<{ corrected: boolean; newStatus?: TransactionState }> {
    if (!transaction.contractTxId) {
      this.logger.warn(
        `Transaction ${transaction.id} lacks a contractTxId; skipping on-chain reconciliation.`,
      );
      return { corrected: false };
    }

    let onChainStatus: string;
    let isMissing = false;

    try {
      onChainStatus = await this.txContract.getTransactionStatus(
        Number(transaction.contractTxId),
      );
    } catch (error) {
      const errMsg = (error as Error)?.message?.toLowerCase() || '';
      if (
        errMsg.includes('not found') ||
        errMsg.includes('does not exist') ||
        errMsg.includes('missing') ||
        errMsg.includes('unknown')
      ) {
        isMissing = true;
        onChainStatus = 'missing';
      } else {
        // Transient network / RPC error: log and do not mutate DB
        this.logger.warn(
          `Failed to retrieve on-chain status for tx ${transaction.id} (contractTxId: ${transaction.contractTxId}): ${(error as Error).message}`,
        );
        return { corrected: false };
      }
    }

    const normalizedStatus = (onChainStatus || '').toLowerCase().trim();
    const fromState = transaction.state;

    // Outcome 1: Landed on-chain but pending/executing in DB -> completed
    if (
      normalizedStatus === 'completed' ||
      normalizedStatus === 'settled' ||
      normalizedStatus === 'success'
    ) {
      transaction.state = TransactionState.COMPLETED;
      transaction.contractState = 'completed';
      transaction.completedAt = Math.floor(Date.now() / 1000);
      await this.transactionRepo.save(transaction);

      try {
        await this.transactionService.applySettlement(transaction);
      } catch (err) {
        this.logger.error(
          `Settlement application error during reconciliation for tx ${transaction.id}: ${(err as Error).message}`,
        );
      }

      await this.transactionService.invalidateCaches(transaction);

      this.logger.warn(
        `[RECONCILIATION CORRECTION] Tx ${transaction.id} corrected: ${fromState} -> ${TransactionState.COMPLETED} (chain status: ${onChainStatus})`,
      );
      this.prometheus.incrementTransactionReconciliationCorrection(
        fromState,
        TransactionState.COMPLETED,
      );
      await this.recordAuditLog(
        transaction,
        fromState,
        TransactionState.COMPLETED,
        `Reconciled against on-chain status: ${onChainStatus}`,
      );

      return { corrected: true, newStatus: TransactionState.COMPLETED };
    }

    // Outcome 2: Missing or failed on-chain -> failed
    if (
      isMissing ||
      normalizedStatus === 'missing' ||
      normalizedStatus === 'not_found' ||
      normalizedStatus === 'failed'
    ) {
      const errorReason =
        isMissing ||
        normalizedStatus === 'missing' ||
        normalizedStatus === 'not_found'
          ? 'Transaction not found on-chain'
          : 'Transaction failed on-chain';

      transaction.state = TransactionState.FAILED;
      transaction.contractState =
        isMissing ||
        normalizedStatus === 'missing' ||
        normalizedStatus === 'not_found'
          ? 'missing'
          : 'failed';
      transaction.errorReason = errorReason;
      await this.transactionRepo.save(transaction);
      await this.transactionService.invalidateCaches(transaction);

      this.logger.warn(
        `[RECONCILIATION CORRECTION] Tx ${transaction.id} corrected: ${fromState} -> ${TransactionState.FAILED} (reason: ${errorReason})`,
      );
      this.prometheus.incrementTransactionReconciliationCorrection(
        fromState,
        TransactionState.FAILED,
      );
      await this.recordAuditLog(
        transaction,
        fromState,
        TransactionState.FAILED,
        errorReason,
      );

      return { corrected: true, newStatus: TransactionState.FAILED };
    }

    // Outcome 3: Already-consistent (still in flight / pending on-chain or identical) -> untouched
    if (
      normalizedStatus === 'pending' ||
      normalizedStatus === 'executing' ||
      normalizedStatus === 'pending_retry' ||
      normalizedStatus === String(fromState)
    ) {
      this.logger.debug(
        `Transaction ${transaction.id} state (${fromState}) is consistent with on-chain status (${onChainStatus}); leaving untouched.`,
      );
      return { corrected: false };
    }

    // Unknown or unmapped status: log warning and leave untouched
    this.logger.warn(
      `Transaction ${transaction.id} returned unrecognized on-chain status '${onChainStatus}'; leaving untouched.`,
    );
    return { corrected: false };
  }

  private async recordAuditLog(
    transaction: Transaction,
    fromState: string,
    toState: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.auditService.logReconciliationAction({
        transactionId: transaction.id,
        beforeState: {
          id: transaction.id,
          contractTxId: transaction.contractTxId,
          state: fromState,
        },
        afterState: {
          id: transaction.id,
          contractTxId: transaction.contractTxId,
          state: toState,
          reason,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist audit log for tx ${transaction.id} reconciliation: ${(err as Error).message}`,
      );
    }
  }
}
