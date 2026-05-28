import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import { Transaction } from './entities/transaction.entity';
import {
  CreateTransactionDto,
  TransactionOperationDto,
} from './dto/create-transaction.dto';
import { ExecuteTransactionDto } from './dto/execute-transaction.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { RecoverTransactionDto } from './dto/recover-transaction.dto';
import {
  BatchCreateTransactionBlueprintDto,
  BatchCreateTransactionsDto,
} from './dto/batch-create-transactions.dto';
import { BatchExecuteTransactionsDto } from './dto/batch-execute-transactions.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionState } from './enums/transaction-state.enum';
import { TransactionContractClient } from '../stellar/transaction-contract.client';
import { Listing } from '../listing/entities/listing.entity';
import { ListingStatus } from '../listing/interfaces/listing.interface';
import { Auction } from '../auction/entities/auction.entity';
import { AuctionStatus } from '../auction/interfaces/auction.interface';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { Nft } from '../nft/entities/nft.entity';
import { StorageService } from '../../storage/storage.service';
import { NftService } from '../nft/nft.service';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../common/enums/user-role.enum';

type ContractExecutionResult = {
  status?: unknown;
  gasUsed?: unknown;
  totalCost?: unknown;
  operationResults?: unknown;
  error?: unknown;
};

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(StellarNft)
    private readonly stellarNftRepo: Repository<StellarNft>,
    @InjectRepository(Nft)
    private readonly nftRepo: Repository<Nft>,
    private readonly txContract: TransactionContractClient,
    private readonly usersService: UsersService,
    private readonly nftService: NftService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async createAndExecutePurchase(
    buyerId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    if (buyerId === dto.sellerId) {
      throw new BadRequestException('Buyer and seller cannot be the same user');
    }

    const metadata = {
      ...(dto.metadata || {}),
      listingId: dto.listingId,
      auctionId: dto.auctionId,
      nftId: dto.nftId,
      buyerId,
      sellerId: dto.sellerId,
    };
    const operations = this.buildOperations(dto.operations);

    let contractTxId: number;
    try {
      contractTxId = await this.txContract.createTransaction(
        buyerId,
        metadata,
        operations,
      );

      for (const operation of operations) {
        await this.txContract.addOperation(contractTxId, operation);
      }
    } catch (error) {
      throw this.mapContractError(error);
    }

    const transaction = this.transactionRepo.create({
      contractTxId: String(contractTxId),
      buyerId,
      sellerId: dto.sellerId,
      nftId: dto.nftId,
      nftContractId: dto.nftContractId,
      nftTokenId: dto.nftTokenId,
      amount: dto.amount.toString(),
      currency: dto.currency || 'XLM',
      state: TransactionState.PENDING,
      contractState: 'pending',
      createdAt: this.getLedgerTimestamp(),
      metadata,
    });

    const saved = await this.transactionRepo.save(transaction);

    try {
      const executed = await this.execute(saved.id, buyerId, {
        maxGas: this.getGasCeiling(),
        config: { auto: true },
      });
      await this.invalidateCaches(executed);
      return executed;
    } catch (error) {
      this.logger.warn(
        `Transaction ${saved.id} execution failed after creation: ${(error as Error).message}`,
      );
      const fallback = await this.findById(saved.id, buyerId);
      await this.invalidateCaches(fallback);
      return fallback;
    }
  }

  async createAndExecuteListingPurchase(
    listingId: string,
    buyerId: string,
    maxGas?: number,
  ): Promise<Transaction> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== 'ACTIVE') {
      throw new ConflictException('Listing is not active');
    }

    return this.createAndExecutePurchase(buyerId, {
      sellerId: listing.sellerId,
      nftContractId: listing.nftContractId,
      nftTokenId: listing.nftTokenId,
      amount: Number(listing.price),
      currency: listing.currency,
      listingId,
      metadata: { source: 'listing', maxGas },
    });
  }

  async createAndExecuteAuctionSettlement(
    auctionId: string,
    buyerId: string,
    amount: number,
    maxGas?: number,
  ): Promise<Transaction> {
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId },
    });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    return this.createAndExecutePurchase(buyerId, {
      sellerId: auction.sellerId,
      nftContractId: auction.nftContractId,
      nftTokenId: auction.nftTokenId,
      amount,
      currency: 'XLM',
      auctionId,
      metadata: { source: 'auction', maxGas },
    });
  }

  async execute(
    id: number,
    callerId: string,
    dto: ExecuteTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.findById(id, callerId);
    this.assertCanMutate(callerId, transaction);

    if (
      transaction.state === TransactionState.COMPLETED ||
      transaction.state === TransactionState.CANCELLED
    ) {
      throw new ConflictException('Transaction is already finalized');
    }

    transaction.state = TransactionState.EXECUTING;
    transaction.executedAt = this.getLedgerTimestamp();
    await this.transactionRepo.save(transaction);

    try {
      const rawResult = await this.txContract.executeTransaction(
        Number(transaction.contractTxId),
        dto.maxGas || this.getGasCeiling(),
        dto.config || {},
      );
      const result = this.parseExecutionResult(rawResult);

      transaction.contractState =
        this.toScalarString(result.status) || 'completed';
      transaction.totalGasUsed =
        result.gasUsed !== undefined
          ? this.toScalarString(result.gasUsed)
          : undefined;
      transaction.totalCost =
        result.totalCost !== undefined
          ? this.toScalarString(result.totalCost)
          : undefined;
      transaction.operationResults = this.toRecord(result.operationResults);

      if (transaction.contractState === 'failed') {
        transaction.state = TransactionState.FAILED;
        transaction.errorReason =
          this.toScalarString(result.error) || 'execution failed';
      } else {
        transaction.state = TransactionState.COMPLETED;
        transaction.completedAt = this.getLedgerTimestamp();
        await this.applySettlement(transaction);
      }

      const saved = await this.transactionRepo.save(transaction);
      await this.invalidateCaches(saved);
      return saved;
    } catch (error) {
      transaction.state = TransactionState.FAILED;
      transaction.errorReason = (error as Error).message;
      const failed = await this.transactionRepo.save(transaction);
      await this.invalidateCaches(failed);
      throw this.mapContractError(error);
    }
  }

  async cancel(
    id: number,
    callerId: string,
    dto: CancelTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.findById(id, callerId);
    this.assertCanMutate(callerId, transaction);

    if (
      transaction.state === TransactionState.COMPLETED ||
      transaction.state === TransactionState.CANCELLED
    ) {
      throw new ConflictException('Transaction is already finalized');
    }

    await this.txContract.cancelTransaction(
      Number(transaction.contractTxId),
      dto.reason || 'cancelled_by_user',
    );

    transaction.state = TransactionState.CANCELLED;
    transaction.contractState = 'cancelled';
    transaction.errorReason = dto.reason;
    const saved = await this.transactionRepo.save(transaction);
    await this.invalidateCaches(saved);
    return saved;
  }

  async recover(
    id: number,
    callerId: string,
    dto: RecoverTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.findById(id, callerId);
    this.assertCanMutate(callerId, transaction);

    const strategy = dto.strategy || 'retry';
    await this.txContract.recoverTransaction(
      Number(transaction.contractTxId),
      strategy,
    );

    if (strategy === 'rollback') {
      await this.rollbackSettlement(transaction);
      transaction.state = TransactionState.ROLLED_BACK;
      transaction.contractState = 'rolled_back';
    } else {
      transaction.state = TransactionState.PENDING;
      transaction.contractState = 'pending';
    }

    const saved = await this.transactionRepo.save(transaction);
    await this.invalidateCaches(saved);
    return saved;
  }

  async estimateGas(id: number, callerId: string) {
    const transaction = await this.findById(id, callerId);
    const estimate = await this.txContract.estimateTransactionGas(
      Number(transaction.contractTxId),
    );

    return {
      id: transaction.id,
      contractTxId: transaction.contractTxId,
      estimatedGas: estimate,
    };
  }

  async addSignature(
    id: number,
    callerId: string,
    signature: string,
  ): Promise<Transaction> {
    const transaction = await this.findById(id, callerId);

    await this.txContract.addSignature(
      Number(transaction.contractTxId),
      callerId,
      signature,
    );

    const previous = this.toRecord(transaction.operationResults) || {};
    const signatureValue = previous.signatures;
    const existingSignatures: string[] = Array.isArray(signatureValue)
      ? signatureValue.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    transaction.operationResults = {
      ...previous,
      signatures: [...existingSignatures, callerId],
    };

    const saved = await this.transactionRepo.save(transaction);
    await this.invalidateCaches(saved);
    return saved;
  }

  async batchCreate(
    callerId: string,
    dto: BatchCreateTransactionsDto,
  ): Promise<Transaction[]> {
    await this.assertCanUseBatch(callerId, dto.blueprints);

    if (dto.blueprints.length > this.getBatchMaxSize()) {
      throw new BadRequestException('Batch size exceeds configured maximum');
    }

    const blueprintPayload = dto.blueprints.map((blueprint) => ({
      creator: blueprint.creatorId,
      metadata: blueprint.metadata || {},
      operations: blueprint.operations || [],
    }));

    const contractIds =
      await this.txContract.batchCreateTransactions(blueprintPayload);

    const now = this.getLedgerTimestamp();
    const entities = dto.blueprints.map((blueprint, index) => {
      return this.transactionRepo.create({
        contractTxId: String(contractIds[index] || now + index),
        buyerId: callerId,
        sellerId: blueprint.sellerId,
        nftId: blueprint.nftId,
        nftContractId: blueprint.nftContractId,
        nftTokenId: blueprint.nftTokenId,
        amount: blueprint.amount.toString(),
        currency: blueprint.currency || 'XLM',
        state: TransactionState.PENDING,
        contractState: 'pending',
        createdAt: now,
        metadata: blueprint.metadata,
      });
    });

    const saved = await this.transactionRepo.save(entities);
    for (const item of saved) {
      await this.invalidateCaches(item);
    }

    return saved;
  }

  async batchExecute(
    callerId: string,
    dto: BatchExecuteTransactionsDto,
  ): Promise<unknown> {
    const localTransactions = await this.transactionRepo.find({
      where: dto.ids.map((id) => ({ id })),
    });

    if (localTransactions.length !== dto.ids.length) {
      throw new NotFoundException('One or more transactions were not found');
    }

    for (const transaction of localTransactions) {
      this.assertCanMutate(callerId, transaction);
    }

    const contractIds = localTransactions.map((tx) => Number(tx.contractTxId));
    const result = await this.txContract.batchExecuteTransactions(
      contractIds,
      dto.config || { maxGas: dto.maxGas || this.getGasCeiling() },
    );

    for (const tx of localTransactions) {
      tx.state = TransactionState.EXECUTING;
      tx.contractState = 'executing';
      tx.executedAt = this.getLedgerTimestamp();
      const saved = await this.transactionRepo.save(tx);
      await this.invalidateCaches(saved);
    }

    return result;
  }

  async getTransactionsForUser(userId: string, query: TransactionQueryDto) {
    const cacheKey = this.getUserHistoryCacheKey(userId, query);
    const cached = await this.cacheManager.get<{
      data: Transaction[];
      page: number;
      limit: number;
      total: number;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const qb = this.transactionRepo
      .createQueryBuilder('tx')
      .where(
        new Brackets((where) => {
          where
            .where('tx.buyerId = :userId', { userId })
            .orWhere('tx.sellerId = :userId', { userId });
        }),
      )
      .orderBy('tx.createdAt', 'DESC');

    if (query.state) {
      qb.andWhere('tx.state = :state', { state: query.state });
    }

    if (query.nftId) {
      qb.andWhere('tx.nftId = :nftId', { nftId: query.nftId });
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const syncedData = await this.syncTransactionsFromContract(data);
    const payload = { data: syncedData, page, limit, total };
    await this.cacheManager.set(cacheKey, payload, 60_000);
    return payload;
  }

  async findById(id: number, callerId?: string): Promise<Transaction> {
    const transaction = await this.transactionRepo.findOne({ where: { id } });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (callerId) {
      this.assertCanRead(callerId, transaction);
    }

    return this.syncContractState(transaction);
  }

  async getByNft(nftId: string): Promise<Transaction[]> {
    const cacheKey = `tx-history:nft:${nftId}`;
    const cached = await this.cacheManager.get<Transaction[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const where: Array<
      { nftId: string } | { nftContractId: string; nftTokenId: string }
    > = [{ nftId }];
    if (nftId.includes(':')) {
      const [contractId, tokenId] = nftId.split(':');
      if (contractId && tokenId) {
        where.push({ nftContractId: contractId, nftTokenId: tokenId });
      }
    }

    const data = await this.transactionRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const synced = await this.syncTransactionsFromContract(data);
    await this.cacheManager.set(cacheKey, synced, 60_000);
    return synced;
  }

  async getByUser(userId: string): Promise<Transaction[]> {
    const cacheKey = this.getUserHistoryCacheKey(userId, {});
    const cached = await this.cacheManager.get<Transaction[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.transactionRepo.find({
      where: [{ buyerId: userId }, { sellerId: userId }],
      order: { createdAt: 'DESC' },
    });

    const synced = await this.syncTransactionsFromContract(data);
    await this.cacheManager.set(cacheKey, synced, 60_000);
    return synced;
  }

  async getQuickStatus(id: number, callerId?: string) {
    const transaction = await this.findById(id, callerId);
    return {
      id: transaction.id,
      contractTxId: transaction.contractTxId,
      state: transaction.state,
      contractState: transaction.contractState,
      errorReason: transaction.errorReason,
    };
  }

  async assertCanUseBatch(
    callerId: string,
    blueprints: BatchCreateTransactionBlueprintDto[],
  ): Promise<void> {
    const caller = await this.usersService.findById(callerId);
    if (!caller) {
      throw new UnauthorizedException('Invalid caller');
    }

    if (caller.role === UserRole.ADMIN) {
      return;
    }

    const canCreate = blueprints.every((blueprint) => {
      return blueprint.creatorId === callerId;
    });

    if (!canCreate) {
      throw new UnauthorizedException(
        'Batch operations are admin/creator only',
      );
    }
  }

  private async syncContractState(
    transaction: Transaction,
  ): Promise<Transaction> {
    try {
      const status = await this.txContract.getTransactionStatus(
        Number(transaction.contractTxId),
      );
      transaction.contractState = status;

      if (
        status === 'failed' &&
        transaction.state !== TransactionState.FAILED
      ) {
        transaction.state = TransactionState.FAILED;
      }

      return this.transactionRepo.save(transaction);
    } catch {
      return transaction;
    }
  }

  private async syncTransactionsFromContract(
    transactions: Transaction[],
  ): Promise<Transaction[]> {
    return Promise.all(
      transactions.map(async (transaction) => {
        const synced = await this.syncContractState(transaction);
        try {
          const events = await this.txContract.getTransactionEvents(
            Number(synced.contractTxId),
          );
          const previous = this.toRecord(synced.operationResults) || {};
          synced.operationResults = {
            ...previous,
            contractEvents: events,
          };
          return this.transactionRepo.save(synced);
        } catch {
          return synced;
        }
      }),
    );
  }

  private assertCanRead(callerId: string, transaction: Transaction): void {
    if (callerId !== transaction.buyerId && callerId !== transaction.sellerId) {
      throw new UnauthorizedException('Not allowed to access this transaction');
    }
  }

  private assertCanMutate(callerId: string, transaction: Transaction): void {
    this.assertCanRead(callerId, transaction);
    if (transaction.state === TransactionState.CANCELLED) {
      throw new ConflictException('Transaction already cancelled');
    }
  }

  private async applySettlement(transaction: Transaction): Promise<void> {
    const listingId = this.readStringMetadata(transaction, 'listingId');
    if (listingId) {
      const listing = await this.listingRepo.findOne({
        where: { id: listingId },
      });
      if (listing) {
        listing.status = ListingStatus.SOLD;
        await this.listingRepo.save(listing);
      }
    }

    const auctionId = this.readStringMetadata(transaction, 'auctionId');
    if (auctionId) {
      const auction = await this.auctionRepo.findOne({
        where: { id: auctionId },
      });
      if (auction) {
        auction.status = AuctionStatus.SETTLED;
        auction.winnerId = transaction.buyerId;
        auction.currentPrice = Number(transaction.amount);
        await this.auctionRepo.save(auction);
      }
    }

    const buyer = await this.usersService.findById(transaction.buyerId);
    const buyerStellarAddress = buyer?.walletAddress || buyer?.address;
    if (buyerStellarAddress) {
      const legacyNft = await this.stellarNftRepo.findOne({
        where: {
          contractId: transaction.nftContractId,
          tokenId: transaction.nftTokenId,
        },
      });
      if (legacyNft) {
        legacyNft.owner = buyerStellarAddress;
        await this.stellarNftRepo.save(legacyNft);
      }
    }

    const nft = await this.resolveNft(transaction);
    if (!nft) {
      return;
    }

    await this.nftService.updateOwnershipViaContract(
      nft.id,
      transaction.buyerId,
      transaction.amount,
    );

    const metadataPayload = {
      nftId: nft.id,
      contractAddress: transaction.nftContractId,
      tokenId: transaction.nftTokenId,
      ownerId: transaction.buyerId,
      amount: transaction.amount,
      currency: transaction.currency,
      updatedAt: new Date().toISOString(),
    };
    const metadataBuffer = Buffer.from(
      JSON.stringify(metadataPayload, null, 2),
      'utf8',
    );
    const storedAsset = await this.storageService.storeAsset(
      {
        originalname: `nft-${nft.id}-ownership.json`,
        mimetype: 'application/json',
        size: metadataBuffer.length,
        buffer: metadataBuffer,
      },
      transaction.buyerId,
      { transactionId: transaction.id, type: 'ownership-transfer' },
    );

    transaction.ipfsMetadataUri = storedAsset.ipfs.uri || undefined;
    await this.transactionRepo.save(transaction);
  }

  private async rollbackSettlement(transaction: Transaction): Promise<void> {
    const listingId = this.readStringMetadata(transaction, 'listingId');
    if (listingId) {
      const listing = await this.listingRepo.findOne({
        where: { id: listingId },
      });
      if (listing) {
        listing.status = ListingStatus.ACTIVE;
        await this.listingRepo.save(listing);
      }
    }

    const auctionId = this.readStringMetadata(transaction, 'auctionId');
    if (auctionId) {
      const auction = await this.auctionRepo.findOne({
        where: { id: auctionId },
      });
      if (auction) {
        auction.status = AuctionStatus.ACTIVE;
        auction.winnerId = undefined;
        await this.auctionRepo.save(auction);
      }
    }
  }

  private async resolveNft(transaction: Transaction): Promise<Nft | null> {
    if (transaction.nftId) {
      const nft = await this.nftRepo.findOne({
        where: { id: transaction.nftId },
      });
      if (nft) {
        return nft;
      }
    }

    return this.nftRepo.findOne({
      where: {
        contractAddress: transaction.nftContractId,
        tokenId: transaction.nftTokenId,
      },
    });
  }

  private buildOperations(
    operations?: TransactionOperationDto[],
  ): Array<Record<string, unknown>> {
    if (operations?.length) {
      return operations.map((operation) => ({
        type: operation.type,
        payload: operation.payload || {},
      }));
    }

    return [
      { type: 'nft_transfer', payload: { validated: true } },
      { type: 'payment', payload: { validated: true } },
      { type: 'royalty', payload: { validated: true } },
    ];
  }

  private getLedgerTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  private getGasCeiling(): number {
    return Number(
      this.configService.get('TRANSACTION_GAS_CEILING') || 1_000_000,
    );
  }

  private getBatchMaxSize(): number {
    return Number(this.configService.get('TRANSACTION_BATCH_MAX_SIZE') || 50);
  }

  private readStringMetadata(
    transaction: Transaction,
    key: string,
  ): string | undefined {
    const value = transaction.metadata?.[key];
    return typeof value === 'string' ? value : undefined;
  }

  private mapContractError(error: unknown): Error {
    const message = error instanceof Error ? error.message : 'Contract error';

    if (message.includes('TransactionNotFound')) {
      return new NotFoundException(message);
    }
    if (
      message.includes('InvalidStateTransition') ||
      message.includes('AlreadyFinalized')
    ) {
      return new ConflictException(message);
    }
    if (message.includes('DependencyNotMet')) {
      return new UnprocessableEntityException(message);
    }
    if (message.includes('SignatureMissing')) {
      return new UnauthorizedException(message);
    }
    if (message.includes('InvalidOperation')) {
      return new BadRequestException(message);
    }

    return new BadRequestException(message);
  }

  private toScalarString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }
    return undefined;
  }

  private parseExecutionResult(value: unknown): ContractExecutionResult {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const payload = value as Record<string, unknown>;
    return {
      status: payload.status,
      gasUsed: payload.gasUsed,
      totalCost: payload.totalCost,
      operationResults: payload.operationResults,
      error: payload.error,
    };
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private getUserHistoryCacheKey(
    userId: string,
    query: Partial<TransactionQueryDto>,
  ): string {
    return `tx-history:user:${userId}:${JSON.stringify(query || {})}`;
  }

  private async invalidateCaches(transaction: Transaction): Promise<void> {
    await Promise.all([
      this.cacheManager.del(
        this.getUserHistoryCacheKey(transaction.buyerId, {}),
      ),
      this.cacheManager.del(
        this.getUserHistoryCacheKey(transaction.sellerId, {}),
      ),
      this.cacheManager.del(`tx-history:nft:${transaction.nftId || ''}`),
      this.cacheManager.del(
        `tx-history:nft:${transaction.nftContractId}:${transaction.nftTokenId}`,
      ),
    ]);
  }
}
