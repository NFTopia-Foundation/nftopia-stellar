import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  TransactionReconciliationJob,
  RECONCILIATION_LOCK_KEY,
} from './transaction-reconciliation.job';
import { Transaction } from './entities/transaction.entity';
import { TransactionState } from './enums/transaction-state.enum';
import { TransactionContractClient } from '../stellar/transaction-contract.client';
import { TransactionService } from './transaction.service';
import { DistributedLockService } from '../../common/locks/distributed-lock.service';
import { AuditService } from '../../common/audit/audit.service';
import { PrometheusService } from '../../common/metrics/prometheus';

describe('TransactionReconciliationJob', () => {
  let job: TransactionReconciliationJob;
  const transactionRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };
  let txContract: {
    getTransactionStatus: jest.Mock;
  };
  let lockService: {
    acquire: jest.Mock;
    release: jest.Mock;
  };
  let transactionService: {
    applySettlement: jest.Mock;
    invalidateCaches: jest.Mock;
  };
  let auditService: {
    logReconciliationAction: jest.Mock;
  };
  let prometheus: {
    incrementTransactionReconciliationCorrection: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  const createMockTransaction = (
    overrides: Partial<Transaction> = {},
  ): Transaction => ({
    id: 1,
    contractTxId: '1001',
    buyerId: 'user-buyer-1',
    sellerId: 'user-seller-1',
    nftContractId: 'CCONTRACT123',
    nftTokenId: '1',
    amount: '50',
    currency: 'XLM',
    state: TransactionState.PENDING,
    contractState: 'pending',
    createdAt: Math.floor(Date.now() / 1000) - 1200, // 20 minutes ago (stale)
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    transactionRepo.save.mockImplementation((tx) => Promise.resolve(tx));

    txContract = {
      getTransactionStatus: jest.fn(),
    };

    lockService = {
      acquire: jest.fn().mockResolvedValue('lock-token-123'),
      release: jest.fn().mockResolvedValue(true),
    };

    transactionService = {
      applySettlement: jest.fn().mockResolvedValue(undefined),
      invalidateCaches: jest.fn().mockResolvedValue(undefined),
    };

    auditService = {
      logReconciliationAction: jest
        .fn()
        .mockResolvedValue({ id: 'audit-log-1' }),
    };

    prometheus = {
      incrementTransactionReconciliationCorrection: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'TRANSACTION_RECONCILIATION_STALE_AGE_SECONDS') return 600;
        if (key === 'TRANSACTION_RECONCILIATION_LOCK_TTL_MS') return 300000;
        if (key === 'TRANSACTION_RECONCILIATION_BATCH_SIZE') return 50;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionReconciliationJob,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepo,
        },
        {
          provide: TransactionContractClient,
          useValue: txContract,
        },
        {
          provide: DistributedLockService,
          useValue: lockService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: TransactionService,
          useValue: transactionService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
        {
          provide: PrometheusService,
          useValue: prometheus,
        },
      ],
    }).compile();

    job = module.get<TransactionReconciliationJob>(
      TransactionReconciliationJob,
    );
  });

  describe('Outcome 1: landed-but-pending -> completed', () => {
    it('should reconcile a landed transaction to COMPLETED, apply settlement, and log correction', async () => {
      const pendingTx = createMockTransaction({
        id: 42,
        contractTxId: '5001',
        state: TransactionState.PENDING,
        contractState: 'pending',
      });

      transactionRepo.find.mockResolvedValue([pendingTx]);
      txContract.getTransactionStatus.mockResolvedValue('completed');

      const result = await job.reconcileStaleTransactions();

      expect(result).toEqual({ examined: 1, corrected: 1, untouched: 0 });
      expect(txContract.getTransactionStatus).toHaveBeenCalledWith(5001);

      // Verify DB update
      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          state: TransactionState.COMPLETED,
          contractState: 'completed',
        }),
      );

      // Verify settlement and cache invalidation
      expect(transactionService.applySettlement).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42 }),
      );
      expect(transactionService.invalidateCaches).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42 }),
      );

      // Verify Prometheus metric increment
      expect(
        prometheus.incrementTransactionReconciliationCorrection,
      ).toHaveBeenCalledWith(
        TransactionState.PENDING,
        TransactionState.COMPLETED,
      );

      // Verify Audit logging
      expect(auditService.logReconciliationAction).toHaveBeenCalledWith({
        transactionId: 42,
        beforeState: {
          id: 42,
          contractTxId: '5001',
          state: TransactionState.PENDING,
        },
        afterState: {
          id: 42,
          contractTxId: '5001',
          state: TransactionState.COMPLETED,
          reason: 'Reconciled against on-chain status: completed',
        },
      });
    });

    it('should reconcile EXECUTING transaction to COMPLETED when chain status is settled', async () => {
      const executingTx = createMockTransaction({
        id: 43,
        contractTxId: '5002',
        state: TransactionState.EXECUTING,
        contractState: 'executing',
      });

      transactionRepo.find.mockResolvedValue([executingTx]);
      txContract.getTransactionStatus.mockResolvedValue('settled');

      const result = await job.reconcileStaleTransactions();

      expect(result.corrected).toBe(1);
      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 43,
          state: TransactionState.COMPLETED,
        }),
      );
      expect(
        prometheus.incrementTransactionReconciliationCorrection,
      ).toHaveBeenCalledWith(
        TransactionState.EXECUTING,
        TransactionState.COMPLETED,
      );
    });
  });

  describe('Outcome 2: missing-on-chain -> failed', () => {
    it('should reconcile transaction missing on-chain to FAILED when contract throws not found', async () => {
      const pendingTx = createMockTransaction({
        id: 77,
        contractTxId: '9001',
        state: TransactionState.PENDING,
        contractState: 'pending',
      });

      transactionRepo.find.mockResolvedValue([pendingTx]);
      txContract.getTransactionStatus.mockRejectedValue(
        new Error('Transaction not found on contract storage'),
      );

      const result = await job.reconcileStaleTransactions();

      expect(result).toEqual({ examined: 1, corrected: 1, untouched: 0 });

      // Verify DB update
      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 77,
          state: TransactionState.FAILED,
          contractState: 'missing',
          errorReason: 'Transaction not found on-chain',
        }),
      );

      // Verify cache invalidation & no settlement applied
      expect(transactionService.invalidateCaches).toHaveBeenCalledWith(
        expect.objectContaining({ id: 77 }),
      );
      expect(transactionService.applySettlement).not.toHaveBeenCalled();

      // Verify Prometheus metric increment
      expect(
        prometheus.incrementTransactionReconciliationCorrection,
      ).toHaveBeenCalledWith(TransactionState.PENDING, TransactionState.FAILED);

      // Verify Audit logging
      expect(auditService.logReconciliationAction).toHaveBeenCalledWith({
        transactionId: 77,
        beforeState: {
          id: 77,
          contractTxId: '9001',
          state: TransactionState.PENDING,
        },
        afterState: {
          id: 77,
          contractTxId: '9001',
          state: TransactionState.FAILED,
          reason: 'Transaction not found on-chain',
        },
      });
    });

    it('should reconcile transaction to FAILED when contract explicitly returns "not_found"', async () => {
      const pendingTx = createMockTransaction({
        id: 78,
        contractTxId: '9002',
        state: TransactionState.PENDING,
      });

      transactionRepo.find.mockResolvedValue([pendingTx]);
      txContract.getTransactionStatus.mockResolvedValue('not_found');

      const result = await job.reconcileStaleTransactions();

      expect(result.corrected).toBe(1);
      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 78,
          state: TransactionState.FAILED,
          errorReason: 'Transaction not found on-chain',
        }),
      );
    });

    it('should reconcile transaction to FAILED when contract returns "failed"', async () => {
      const pendingTx = createMockTransaction({
        id: 79,
        contractTxId: '9003',
        state: TransactionState.PENDING,
      });

      transactionRepo.find.mockResolvedValue([pendingTx]);
      txContract.getTransactionStatus.mockResolvedValue('failed');

      const result = await job.reconcileStaleTransactions();

      expect(result.corrected).toBe(1);
      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 79,
          state: TransactionState.FAILED,
          errorReason: 'Transaction failed on-chain',
        }),
      );
      expect(
        prometheus.incrementTransactionReconciliationCorrection,
      ).toHaveBeenCalledWith(TransactionState.PENDING, TransactionState.FAILED);
    });
  });

  describe('Outcome 3: already-consistent -> untouched', () => {
    it('should leave transaction untouched when contract status is pending', async () => {
      const pendingTx = createMockTransaction({
        id: 100,
        contractTxId: '7001',
        state: TransactionState.PENDING,
        contractState: 'pending',
      });

      transactionRepo.find.mockResolvedValue([pendingTx]);
      txContract.getTransactionStatus.mockResolvedValue('pending');

      const result = await job.reconcileStaleTransactions();

      expect(result).toEqual({ examined: 1, corrected: 0, untouched: 1 });
      expect(transactionRepo.save).not.toHaveBeenCalled();
      expect(transactionService.applySettlement).not.toHaveBeenCalled();
      expect(transactionService.invalidateCaches).not.toHaveBeenCalled();
      expect(
        prometheus.incrementTransactionReconciliationCorrection,
      ).not.toHaveBeenCalled();
      expect(auditService.logReconciliationAction).not.toHaveBeenCalled();
    });

    it('should leave transaction untouched when contract status is executing', async () => {
      const executingTx = createMockTransaction({
        id: 101,
        contractTxId: '7002',
        state: TransactionState.EXECUTING,
        contractState: 'executing',
      });

      transactionRepo.find.mockResolvedValue([executingTx]);
      txContract.getTransactionStatus.mockResolvedValue('executing');

      const result = await job.reconcileStaleTransactions();

      expect(result.untouched).toBe(1);
      expect(result.corrected).toBe(0);
      expect(transactionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Transient RPC errors', () => {
    it('should not mutate transaction when contract RPC throws transient network error', async () => {
      const pendingTx = createMockTransaction({
        id: 200,
        contractTxId: '8001',
        state: TransactionState.PENDING,
      });

      transactionRepo.find.mockResolvedValue([pendingTx]);
      txContract.getTransactionStatus.mockRejectedValue(
        new Error('HTTP 503 Service Unavailable / Connection reset by peer'),
      );

      const result = await job.reconcileStaleTransactions();

      expect(result).toEqual({ examined: 1, corrected: 0, untouched: 1 });
      expect(transactionRepo.save).not.toHaveBeenCalled();
      expect(
        prometheus.incrementTransactionReconciliationCorrection,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Distributed locking', () => {
    it('should acquire lock, run reconciliation, and release lock on success', async () => {
      transactionRepo.find.mockResolvedValue([]);

      await job.handleReconciliation();

      expect(lockService.acquire).toHaveBeenCalledWith(
        RECONCILIATION_LOCK_KEY,
        300000,
      );
      expect(lockService.release).toHaveBeenCalledWith(
        RECONCILIATION_LOCK_KEY,
        'lock-token-123',
      );
    });

    it('should skip reconciliation if lock is held by another instance', async () => {
      lockService.acquire.mockResolvedValue(null);

      await job.handleReconciliation();

      expect(transactionRepo.find).not.toHaveBeenCalled();
      expect(lockService.release).not.toHaveBeenCalled();
    });

    it('should release lock in finally block even if reconciliation throws an error', async () => {
      transactionRepo.find.mockRejectedValue(new Error('Database error'));

      await job.handleReconciliation();

      expect(lockService.release).toHaveBeenCalledWith(
        RECONCILIATION_LOCK_KEY,
        'lock-token-123',
      );
    });
  });
});
