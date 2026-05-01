import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import {
  AcceptOfferParams,
  CreateAuctionParams,
  CreateTradeParams,
  CreateSaleParams,
} from '../../shared/contracts/marketplace-settlement.types';
import { ConfigService } from '@nestjs/config';
import { SorobanService, SorobanContractArg } from './soroban.service';

@Injectable()
export class MarketplaceSettlementClient {
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
  constructor(
    private readonly sorobanService: SorobanService,
    private readonly configService: ConfigService,
  ) {
    const contractId = this.configService.get<string>(
      'MARKETPLACE_SETTLEMENT_CONTRACT_ID',
    );
    if (!contractId)
      throw new ServiceUnavailableException(
        'MARKETPLACE_SETTLEMENT_CONTRACT_ID not set',
      );
    this.contractId = contractId;
    this.txTimeout =
      this.configService.get<number>('CONTRACT_TRANSACTION_TIMEOUT') ?? 60;
  }
  private readonly logger = new Logger(MarketplaceSettlementClient.name);
  private readonly contractId: string;
  private readonly txTimeout: number;

  /**
   * Retry helper for contract calls. Retries up to 3 times with exponential backoff (500ms, 1000ms, 2000ms).
   * Only retries on transient errors (network, timeout, service unavailable).
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        let msg = '';
        if (
          typeof err === 'object' &&
          err &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
        ) {
          msg = (err as { message: string }).message;
        }
        if (
          attempt < maxAttempts &&
          (msg.includes('timeout') ||
            msg.includes('network') ||
            msg.includes('ServiceUnavailable') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('502') ||
            msg.includes('503') ||
            msg.includes('504'))
        ) {
          const backoff = 500 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        break;
      }
    }
    this.handleContractError(lastError);
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

  // Error mapping
  private handleContractError(err: any): never {
    // Map contract errors to application errors
    let msg = '';
    if (
      typeof err === 'object' &&
      err &&
      'message' in err &&
      typeof (err as { message?: unknown }).message === 'string'
    ) {
      msg = (err as { message: string }).message;
    }
    if (msg.includes('insufficient balance')) {
      throw new Error('Insufficient balance for contract operation');
    }
    if (msg.includes('not found')) {
      throw new Error('Resource not found in contract');
    }
    if (msg.includes('timeout')) {
      throw new Error('Contract call timed out');
    }
    throw new Error(msg || 'Unknown contract error');
  }
}
