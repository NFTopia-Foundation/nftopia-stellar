import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
  NotFoundException,
  GatewayTimeoutException,
  PaymentRequiredException,
  UnauthorizedException,
  UnprocessableEntityException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  AcceptOfferParams,
  CreateAuctionParams,
  CreateTradeParams,
  CreateSaleParams,
  CreateBundleParams,
} from '../../shared/contracts/marketplace-settlement.types';
import { ConfigService } from '@nestjs/config';
import { SorobanService, SorobanContractArg } from './soroban.service';

// Custom error classes for better error discrimination
export class SorobanContractError extends UnprocessableEntityException {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ContractError';
  }
}

export class SorobanRpcError extends ServiceUnavailableException {
  constructor(message: string) {
    super(message);
    this.name = 'SorobanRpcError';
  }
}

export class InsufficientBalanceError extends PaymentRequiredException {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export class InvalidSignatureError extends UnauthorizedException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSignatureError';
  }
}

export class TransactionFailedError extends BadRequestException {
  constructor(message: string, public readonly txHash?: string) {
    super(message);
    this.name = 'TransactionFailedError';
  }
}

@Injectable()
export class MarketplaceSettlementClient {
  constructor(
    private readonly sorobanService: SorobanService,
    private readonly configService: ConfigService,
  ) {
    const contractId = this.configService.get<string>(
      'MARKETPLACE_SETTLEMENT_CONTRACT_ID',
    );
    if (!contractId) {
      throw new ServiceUnavailableException(
        'MARKETPLACE_SETTLEMENT_CONTRACT_ID not set',
      );
    }
    this.contractId = contractId;
    this.txTimeout =
      this.configService.get<number>('CONTRACT_TRANSACTION_TIMEOUT') ?? 60;
  }

  private readonly logger = new Logger(MarketplaceSettlementClient.name);
  private readonly contractId: string;
  private readonly txTimeout: number;

  /**
   * Retry helper for contract calls. Retries up to 3 times with exponential backoff.
   * Preserves HttpException types when re-throwing after retries.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        const msg = this.extractErrorMessage(err);

        // Only retry on transient errors
        const isTransient =
          msg.includes('timeout') ||
          msg.includes('network') ||
          msg.includes('ServiceUnavailable') ||
          msg.includes('ECONNREFUSED') ||
          msg.includes('502') ||
          msg.includes('503') ||
          msg.includes('504') ||
          msg.includes('GatewayTimeout');

        if (attempt < maxAttempts && isTransient) {
          const backoff = 500 * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Retry ${attempt}/${maxAttempts} after ${backoff}ms: ${msg}`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        break;
      }
    }

    // Preserve the original error type if it's already an HttpException
    if (lastError instanceof HttpException) {
      throw lastError;
    }

    // Otherwise, map and throw the appropriate typed exception
    this.handleContractError(lastError);
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (
      typeof err === 'object' &&
      err &&
      'message' in err &&
      typeof (err as { message?: unknown }).message === 'string'
    ) {
      return (err as { message: string }).message;
    }
    return '';
  }

  /**
   * Map contract errors to domain-specific HttpExceptions.
   * This method preserves error types and adds proper error codes for the interceptor.
   */
  private handleContractError(err: unknown): never {
    const msg = this.extractErrorMessage(err);

    // Log the error with context
    this.logger.error(
      `Contract error: ${msg}`,
      err instanceof Error ? err.stack : undefined,
    );

    // Check for specific error patterns and throw appropriate typed exceptions
    if (msg.includes('insufficient balance') || msg.includes('insufficient funds')) {
      throw new InsufficientBalanceError(
        'Insufficient balance for contract operation',
      );
    }

    if (msg.includes('not found') || msg.includes('does not exist')) {
      throw new NotFoundException('Resource not found in contract');
    }

    if (msg.includes('timeout') || msg.includes('timed out')) {
      throw new GatewayTimeoutException('Contract call timed out');
    }

    if (msg.includes('invalid signature') || msg.includes('signature')) {
      throw new InvalidSignatureError('Invalid signature for contract operation');
    }

    if (msg.includes('contract') && (msg.includes('revert') || msg.includes('failed'))) {
      throw new SorobanContractError(
        'Contract execution failed',
        { originalMessage: msg },
      );
    }

    if (
      msg.includes('rpc') ||
      msg.includes('network') ||
      msg.includes('unavailable') ||
      msg.includes('connection')
    ) {
      throw new SorobanRpcError('Soroban RPC service unavailable');
    }

    if (msg.includes('invalid') || msg.includes('validation')) {
      throw new BadRequestException(msg);
    }

    // Unknown error - preserve the original message for debugging
    throw new InternalServerErrorException(
      msg || 'Unknown contract error occurred',
    );
  }

  async createSale(params: CreateSaleParams): Promise<number> {
    return this.withRetry(async () => {
      if (
        !params ||
        typeof params !== 'object' ||
        typeof params.seller !== 'string' ||
        typeof params.nftContract !== 'string' ||
        typeof params.tokenId !== 'string' ||
        typeof params.price !== 'string' ||
        typeof params.currency !== 'string' ||
        typeof params.durationSeconds !== 'number'
      ) {
        throw new BadRequestException('Invalid CreateSaleParams');
      }
      const args: SorobanContractArg[] = [
        { type: 'address', value: params.seller },
        { type: 'string', value: params.nftContract },
        { type: 'string', value: params.tokenId },
        { type: 'i128', value: params.price },
        { type: 'string', value: params.currency },
        { type: 'u64', value: params.durationSeconds },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'create_sale',
        args,
      );
      return result.returnValue as number;
    });
  }

  async executeSale(
    txId: number,
    buyer: string,
    amount?: string,
  ): Promise<any> {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [
        { type: 'u64', value: txId },
        { type: 'address', value: buyer },
      ];
      if (amount !== undefined) args.push({ type: 'i128', value: amount });
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'execute_sale',
        args,
      );
      return result.returnValue;
    });
  }

  async createBundle(params: CreateBundleParams): Promise<number> {
    return this.withRetry(async () => {
      if (
        !params ||
        typeof params !== 'object' ||
        typeof params.seller !== 'string' ||
        !Array.isArray(params.items) ||
        typeof params.totalPrice !== 'string' ||
        typeof params.currency !== 'string' ||
        typeof params.durationSeconds !== 'number'
      ) {
        throw new BadRequestException('Invalid CreateBundleParams');
      }
      const args: SorobanContractArg[] = [
        { type: 'address', value: params.seller },
        { type: 'raw', value: params.items },
        { type: 'i128', value: params.totalPrice },
        { type: 'string', value: params.currency },
        { type: 'u64', value: params.durationSeconds },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'create_bundle',
        args,
      );
      return result.returnValue as number;
    });
  }

  async executeBundle(
    bundleId: number,
    buyer: string,
    amount?: string,
  ): Promise<any> {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [
        { type: 'u64', value: bundleId },
        { type: 'address', value: buyer },
      ];
      if (amount !== undefined) args.push({ type: 'i128', value: amount });
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'execute_bundle',
        args,
      );
      return result.returnValue;
    });
  }

  async cancelBundle(bundleId: number, seller: string): Promise<any> {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [
        { type: 'u64', value: bundleId },
        { type: 'address', value: seller },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'cancel_bundle',
        args,
      );
      return result.returnValue;
    });
  }

  async createAuction(params: CreateAuctionParams): Promise<number> {
    return this.withRetry(async () => {
      if (
        !params ||
        typeof params !== 'object' ||
        typeof params.seller !== 'string' ||
        typeof params.nftContract !== 'string' ||
        typeof params.tokenId !== 'string' ||
        typeof params.startPrice !== 'string' ||
        typeof params.reservePrice !== 'string' ||
        typeof params.currency !== 'string' ||
        typeof params.auctionType !== 'string' ||
        typeof params.durationSeconds !== 'number'
      ) {
        throw new BadRequestException('Invalid CreateAuctionParams');
      }
      const safeParams = params;
      const args: SorobanContractArg[] = [
        { type: 'address', value: safeParams.seller },
        { type: 'string', value: safeParams.nftContract },
        { type: 'string', value: safeParams.tokenId },
        { type: 'i128', value: safeParams.startPrice },
        { type: 'i128', value: safeParams.reservePrice },
        { type: 'string', value: safeParams.currency },
        { type: 'symbol', value: safeParams.auctionType },
        { type: 'u64', value: safeParams.durationSeconds },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'create_auction',
        args,
      );
      return result.returnValue as number;
    });
  }

  async placeBid(
    auctionId: number,
    bidder: string,
    amount: string,
    commitment?: string,
  ) {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [
        { type: 'u64', value: auctionId },
        { type: 'address', value: bidder },
        { type: 'i128', value: amount },
      ];
      if (commitment) args.push({ type: 'string', value: commitment });
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'place_bid',
        args,
      );
      return result.returnValue;
    });
  }

  async revealBid(
    auctionId: number,
    bidder: string,
    amount: string,
    salt: string,
  ) {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [
        { type: 'u64', value: auctionId },
        { type: 'address', value: bidder },
        { type: 'i128', value: amount },
        { type: 'string', value: salt },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'reveal_bid',
        args,
      );
      return result.returnValue;
    });
  }

  async endAuction(auctionId: number, caller: string) {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [
        { type: 'u64', value: auctionId },
        { type: 'address', value: caller },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'end_auction',
        args,
      );
      return result.returnValue;
    });
  }

  async createTrade(params: CreateTradeParams): Promise<number> {
    return this.withRetry(async () => {
      if (
        !params ||
        typeof params !== 'object' ||
        typeof params.initiator !== 'string' ||
        typeof params.offeredNftContract !== 'string' ||
        typeof params.offeredTokenId !== 'string' ||
        typeof params.requestedNftContract !== 'string' ||
        typeof params.requestedTokenId !== 'string' ||
        typeof params.expiresAt !== 'string'
      ) {
        throw new BadRequestException('Invalid CreateTradeParams');
      }
      const safeParams = params;
      const args: SorobanContractArg[] = [
        { type: 'address', value: safeParams.initiator },
        { type: 'string', value: safeParams.offeredNftContract },
        { type: 'string', value: safeParams.offeredTokenId },
        { type: 'string', value: safeParams.requestedNftContract },
        { type: 'string', value: safeParams.requestedTokenId },
        { type: 'string', value: safeParams.expiresAt },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'create_trade',
        args,
      );
      return result.returnValue as number;
    });
  }

  async acceptTrade(tradeId: number, acceptor: string) {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [
        { type: 'u64', value: tradeId },
        { type: 'address', value: acceptor },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'accept_trade',
        args,
      );
      return result.returnValue;
    });
  }

  async executeTrade(tradeId: number, executor: string) {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [
        { type: 'u64', value: tradeId },
        { type: 'address', value: executor },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'execute_trade',
        args,
      );
      return result.returnValue;
    });
  }

  // Queries
  async getSale(txId: number): Promise<any> {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [{ type: 'u64', value: txId }];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'get_sale',
        args,
      );
      return result.returnValue;
    });
  }

  async getAuction(auctionId: number): Promise<any> {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [{ type: 'u64', value: auctionId }];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'get_auction',
        args,
      );
      return result.returnValue;
    });
  }

  async getAccumulatedFees(asset: string): Promise<any> {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [{ type: 'string', value: asset }];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'get_accumulated_fees',
        args,
      );
      return result.returnValue;
    });
  }

  async getUserVolume(user: string): Promise<any> {
    return this.withRetry(async () => {
      const args: SorobanContractArg[] = [{ type: 'address', value: user }];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'get_user_volume',
        args,
      );
      return result.returnValue;
    });
  }

  /**
   * Fetch contract events emitted since a given ledger sequence via Soroban RPC.
   * Returns { events, latestLedger } so the caller can advance its cursor even
   * when no events are returned.
   */
  async getEventsSince(
    fromLedger: number,
  ): Promise<{ events: Record<string, unknown>[]; latestLedger: number }> {
    const startLedger = fromLedger > 0 ? fromLedger : undefined;
    const server = this.sorobanService.getRpcServer();

    const fetchStart = Date.now();
    this.logger.debug(
      `getEventsSince: fetching events from ledger=${fromLedger}`,
    );

    try {
      const response = await server.getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds: [this.contractId] }],
      });

      const latestLedger: number =
        (response as unknown as { latestLedger?: number }).latestLedger ??
        fromLedger;

      const events = (response.events ?? []).map(
        (e) => e as unknown as Record<string, unknown>,
      );

      this.logger.log(
        `getEventsSince: fromLedger=${fromLedger} latestLedger=${latestLedger} ` +
          `eventsCount=${events.length} durationMs=${Date.now() - fetchStart}`,
      );

      return { events, latestLedger };
    } catch (error) {
      this.handleContractError(error);
    }
  }

  /**
   * Build the Soroban transaction XDR for accepting a direct XLM offer on an NFT.
   * Returns the unsigned transaction XDR for the owner to sign and broadcast.
   */
  async acceptOffer(params: AcceptOfferParams): Promise<string> {
    return this.withRetry(async () => {
      if (
        !params ||
        typeof params !== 'object' ||
        typeof params.offerId !== 'string' ||
        typeof params.owner !== 'string' ||
        typeof params.bidder !== 'string' ||
        typeof params.nftContractId !== 'string' ||
        typeof params.nftTokenId !== 'string' ||
        typeof params.amount !== 'string' ||
        typeof params.currency !== 'string'
      ) {
        throw new BadRequestException('Invalid AcceptOfferParams');
      }
      const args: SorobanContractArg[] = [
        { type: 'string', value: params.offerId },
        { type: 'address', value: params.owner },
        { type: 'address', value: params.bidder },
        { type: 'string', value: params.nftContractId },
        { type: 'string', value: params.nftTokenId },
        { type: 'i128', value: params.amount },
        { type: 'string', value: params.currency },
      ];
      const result = await this.sorobanService.invokeContract(
        this.contractId,
        'accept_offer',
        args,
        { submit: false },
      );
      const tx = result.transaction as { transactionXdr?: string } | undefined;
      return tx?.transactionXdr ?? '';
    });
  }
}

// Export error classes for use in other modules
export {
  SorobanContractError as ContractError,
  SorobanRpcError as RpcError,
  InsufficientBalanceError,
  InvalidSignatureError,
  TransactionFailedError,
};