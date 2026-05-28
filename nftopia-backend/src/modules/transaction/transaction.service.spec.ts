import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TransactionService } from './transaction.service';
import { Transaction } from './entities/transaction.entity';
import { Listing } from '../listing/entities/listing.entity';
import { Auction } from '../auction/entities/auction.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { Nft } from '../nft/entities/nft.entity';
import { TransactionContractClient } from '../stellar/transaction-contract.client';
import { UsersService } from '../../users/users.service';
import { NftService } from '../nft/nft.service';
import { StorageService } from '../../storage/storage.service';
import { TransactionState } from './enums/transaction-state.enum';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('TransactionService', () => {
  let service: TransactionService;

  const transactionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findBy: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const listingRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const auctionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const stellarNftRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const nftRepo = {
    findOne: jest.fn(),
  };

  const txContract = {
    createTransaction: jest.fn(),
    addOperation: jest.fn(),
    executeTransaction: jest.fn(),
    cancelTransaction: jest.fn(),
    estimateTransactionGas: jest.fn(),
    batchCreateTransactions: jest.fn(),
    batchExecuteTransactions: jest.fn(),
    addSignature: jest.fn(),
    recoverTransaction: jest.fn(),
    getTransactionStatus: jest.fn(),
    getTransactionEvents: jest.fn(),
  };

  const usersService = {
    findById: jest.fn(),
  };

  const nftService = {
    updateOwnershipViaContract: jest.fn(),
  };

  const storageService = {
    storeAsset: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'TRANSACTION_GAS_CEILING') return 1_000_000;
      if (key === 'TRANSACTION_BATCH_MAX_SIZE') return 50;
      return undefined;
    }),
  };

  const cacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: getRepositoryToken(Transaction), useValue: transactionRepo },
        { provide: getRepositoryToken(Listing), useValue: listingRepo },
        { provide: getRepositoryToken(Auction), useValue: auctionRepo },
        { provide: getRepositoryToken(StellarNft), useValue: stellarNftRepo },
        { provide: getRepositoryToken(Nft), useValue: nftRepo },
        { provide: TransactionContractClient, useValue: txContract },
        { provide: UsersService, useValue: usersService },
        { provide: NftService, useValue: nftService },
        { provide: StorageService, useValue: storageService },
        { provide: ConfigService, useValue: configService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = moduleRef.get(TransactionService);
  });

  it('creates and executes purchase transactions', async () => {
    txContract.createTransaction.mockResolvedValue(101);
    txContract.addOperation.mockResolvedValue(undefined);

    const created = {
      id: 1,
      contractTxId: '101',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      nftContractId: 'CABC',
      nftTokenId: '1',
      amount: '12.5',
      currency: 'XLM',
      state: TransactionState.PENDING,
      metadata: {},
    };

    transactionRepo.create.mockReturnValue(created);
    transactionRepo.save
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce(created)
      .mockResolvedValue({ ...created, state: TransactionState.COMPLETED });
    transactionRepo.findOne.mockResolvedValue(created);
    txContract.getTransactionStatus.mockResolvedValue('pending');
    txContract.getTransactionEvents.mockResolvedValue([]);
    txContract.executeTransaction.mockResolvedValue({ status: 'completed' });
    usersService.findById.mockResolvedValue({ id: 'buyer-1' });
    nftRepo.findOne.mockResolvedValue(null);

    const result = await service.createAndExecutePurchase('buyer-1', {
      sellerId: 'seller-1',
      nftContractId: 'CABC',
      nftTokenId: '1',
      amount: 12.5,
    });

    expect(txContract.createTransaction).toHaveBeenCalled();
    expect(txContract.addOperation).toHaveBeenCalled();
    expect(result.contractTxId).toBe('101');
  });

  it('cancels a pending transaction', async () => {
    const tx = {
      id: 2,
      contractTxId: '202',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      state: TransactionState.PENDING,
    } as Transaction;

    transactionRepo.findOne.mockResolvedValue(tx);
    txContract.getTransactionStatus.mockResolvedValue('pending');
    txContract.getTransactionEvents.mockResolvedValue([]);
    txContract.cancelTransaction.mockResolvedValue(undefined);
    transactionRepo.save.mockResolvedValue({
      ...tx,
      contractState: 'pending',
    });

    const result = await service.cancel(2, 'buyer-1', {
      reason: 'user_cancel',
    });

    expect(txContract.cancelTransaction).toHaveBeenCalledWith(
      202,
      'user_cancel',
    );
    expect(result.state).toBe(TransactionState.CANCELLED);
  });

  it('recovers with rollback strategy', async () => {
    const tx = {
      id: 3,
      contractTxId: '303',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      state: TransactionState.FAILED,
      metadata: {},
    } as Transaction;

    transactionRepo.findOne.mockResolvedValue(tx);
    txContract.getTransactionStatus.mockResolvedValue('failed');
    txContract.getTransactionEvents.mockResolvedValue([]);
    txContract.recoverTransaction.mockResolvedValue(undefined);
    transactionRepo.save.mockResolvedValue({
      ...tx,
      state: TransactionState.ROLLED_BACK,
    });

    const result = await service.recover(3, 'buyer-1', {
      strategy: 'rollback',
    });

    expect(txContract.recoverTransaction).toHaveBeenCalledWith(303, 'rollback');
    expect(result.state).toBe(TransactionState.ROLLED_BACK);
  });

  it('estimates gas for a transaction', async () => {
    const tx = {
      id: 4,
      contractTxId: '404',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      state: TransactionState.PENDING,
    } as Transaction;

    transactionRepo.findOne.mockResolvedValue(tx);
    txContract.getTransactionStatus.mockResolvedValue('pending');
    txContract.getTransactionEvents.mockResolvedValue([]);
    txContract.estimateTransactionGas.mockResolvedValue(12345);

    const result = await service.estimateGas(4, 'buyer-1');

    expect(result.estimatedGas).toBe(12345);
  });

  it('adds signatures to operation results', async () => {
    const tx = {
      id: 5,
      contractTxId: '505',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      state: TransactionState.PENDING,
      operationResults: {},
    } as Transaction;

    transactionRepo.findOne.mockResolvedValue(tx);
    txContract.getTransactionStatus.mockResolvedValue('pending');
    txContract.getTransactionEvents.mockResolvedValue([]);
    txContract.addSignature.mockResolvedValue(undefined);
    transactionRepo.save.mockResolvedValue(tx);

    const result = await service.addSignature(5, 'buyer-1', 'sig');

    expect(result.operationResults?.signatures).toEqual(['buyer-1']);
  });

  it('creates batch transactions', async () => {
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.ADMIN,
    });
    txContract.batchCreateTransactions.mockResolvedValue([1, 2]);
    transactionRepo.create
      .mockReturnValueOnce({ contractTxId: '1' })
      .mockReturnValueOnce({ contractTxId: '2' });
    transactionRepo.save.mockResolvedValue([
      { contractTxId: '1' },
      { contractTxId: '2' },
    ]);

    const result: Transaction[] = await service.batchCreate('admin-1', {
      blueprints: [
        {
          creatorId: 'admin-1',
          sellerId: 'seller-1',
          nftContractId: 'C1',
          nftTokenId: '1',
          amount: 10,
        },
        {
          creatorId: 'admin-1',
          sellerId: 'seller-2',
          nftContractId: 'C2',
          nftTokenId: '2',
          amount: 20,
        },
      ],
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('rejects non admin/creator batch requests', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      role: UserRole.USER,
    });

    await expect(
      service.assertCanUseBatch('user-1', [
        {
          creatorId: 'other-user',
          sellerId: 'seller-1',
          nftContractId: 'C1',
          nftTokenId: '1',
          amount: 10,
        },
      ]),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns quick status payload', async () => {
    const tx = {
      id: 6,
      contractTxId: '606',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      state: TransactionState.PENDING,
      contractState: 'pending',
      errorReason: undefined,
    } as Transaction;

    transactionRepo.findOne.mockResolvedValue(tx);
    txContract.getTransactionStatus.mockResolvedValue('pending');
    txContract.getTransactionEvents.mockResolvedValue([]);
    transactionRepo.save.mockResolvedValue(tx);

    const result = await service.getQuickStatus(6, 'buyer-1');

    expect(result.id).toBe(6);
    expect(result.contractState).toBe('pending');
  });

  it('creates and executes a listing purchase', async () => {
    listingRepo.findOne.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      nftContractId: 'C1',
      nftTokenId: '10',
      price: 5,
      currency: 'XLM',
      status: 'ACTIVE',
    });

    txContract.createTransaction.mockResolvedValue(707);
    txContract.addOperation.mockResolvedValue(undefined);
    txContract.getTransactionStatus.mockResolvedValue('pending');
    txContract.getTransactionEvents.mockResolvedValue([]);
    txContract.executeTransaction.mockResolvedValue({ status: 'completed' });
    const tx = {
      id: 7,
      contractTxId: '707',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      nftContractId: 'C1',
      nftTokenId: '10',
      amount: '5',
      currency: 'XLM',
      state: TransactionState.PENDING,
      metadata: {},
    };
    transactionRepo.create.mockReturnValue(tx);
    transactionRepo.save.mockResolvedValue({
      ...tx,
      contractState: 'pending',
    });
    transactionRepo.findOne.mockResolvedValue(tx);
    usersService.findById.mockResolvedValue({ id: 'buyer-1' });
    nftRepo.findOne.mockResolvedValue(null);

    const result: Transaction = await service.createAndExecuteListingPurchase(
      'listing-1',
      'buyer-1',
    );

    expect(result.contractTxId).toBe('707');
  });

  it('creates and executes an auction settlement', async () => {
    auctionRepo.findOne.mockResolvedValue({
      id: 'auction-1',
      sellerId: 'seller-1',
      nftContractId: 'C2',
      nftTokenId: '11',
    });

    txContract.createTransaction.mockResolvedValue(808);
    txContract.addOperation.mockResolvedValue(undefined);
    txContract.getTransactionStatus.mockResolvedValue('pending');
    txContract.getTransactionEvents.mockResolvedValue([]);
    txContract.executeTransaction.mockResolvedValue({ status: 'completed' });
    const tx = {
      id: 8,
      contractTxId: '808',
      buyerId: 'buyer-2',
      sellerId: 'seller-1',
      nftContractId: 'C2',
      nftTokenId: '11',
      amount: '15',
      currency: 'XLM',
      state: TransactionState.PENDING,
      metadata: {},
    };
    transactionRepo.create.mockReturnValue(tx);
    transactionRepo.save
      .mockResolvedValueOnce(tx)
      .mockResolvedValueOnce(tx)
      .mockResolvedValue({ ...tx, state: TransactionState.COMPLETED });
    transactionRepo.findOne.mockResolvedValue(tx);
    usersService.findById.mockResolvedValue({ id: 'buyer-2' });
    nftRepo.findOne.mockResolvedValue(null);

    const result: Transaction = await service.createAndExecuteAuctionSettlement(
      'auction-1',
      'buyer-2',
      15,
    );

    expect(result.contractTxId).toBe('808');
  });

  it('executes batch transactions', async () => {
    txContract.batchExecuteTransactions.mockResolvedValue({ success: true });
    const txA = {
      id: 10,
      contractTxId: '1001',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      state: TransactionState.PENDING,
    } as Transaction;
    const txB = {
      id: 11,
      contractTxId: '1002',
      buyerId: 'buyer-1',
      sellerId: 'seller-2',
      state: TransactionState.PENDING,
    } as Transaction;
    transactionRepo.find.mockResolvedValue([txA, txB]);
    transactionRepo.save.mockResolvedValue(txA);

    const result = await service.batchExecute('buyer-1', {
      ids: [10, 11],
      maxGas: 1000,
    });

    expect(result).toEqual({ success: true });
  });

  it('returns cached user history when present', async () => {
    cacheManager.get.mockResolvedValueOnce({
      data: [],
      page: 1,
      limit: 20,
      total: 0,
    });

    const result: {
      data: Transaction[];
      page: number;
      limit: number;
      total: number;
    } = await service.getTransactionsForUser('user-1', {} as never);

    expect(result.total).toBe(0);
    expect(transactionRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
