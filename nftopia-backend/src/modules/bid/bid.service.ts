import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Contract,
  Address,
  nativeToScVal,
  Horizon,
} from 'stellar-sdk';
import { Server as SorobanServer } from 'stellar-sdk/rpc';

import { Bid, BidSorobanStatus } from '../auction/entities/bid.entity';
import { Auction } from '../auction/entities/auction.entity';
import { AuctionStatus } from '../auction/interfaces/auction.interface';
import { User } from '../../users/user.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidQueryDto } from './dto/bid-query.dto';
import { StellarSignatureStrategy } from '../../auth/strategies/stellar.strategy';
import {
  BID_PLACED_EVENT,
  BID_CACHE_PREFIX,
  BID_CACHE_TTL_S,
  BID_RATE_LIMIT_PREFIX,
  BID_RATE_LIMIT_MAX,
  BID_RATE_LIMIT_WINDOW_S,
  BID_MIN_INCREMENT_PCT,
  STROOPS_PER_XLM,
  type BidPlacedEvent,
  type HighestBidResult,
  type BidListResult,
} from './interfaces/bid.interface';

@Injectable()
export class BidService {
  private readonly logger = new Logger(BidService.name);

  constructor(
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
    private readonly stellarStrategy: StellarSignatureStrategy,
    private readonly configService: ConfigService,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async placeBid(
    auctionId: string,
    bidderId: string,
    dto: PlaceBidDto,
  ): Promise<Bid> {
    await this.enforceRateLimit(bidderId);

    const auction = await this.loadActiveAuction(auctionId);

    if (auction.sellerId === bidderId) {
      throw new ForbiddenException('Sellers cannot bid on their own auctions');
    }

    this.verifySignature(auctionId, dto);

    const amountXlm = parseFloat(dto.amount);
    const amountInStroops = Math.round(amountXlm * STROOPS_PER_XLM);

    await this.validateBidAmount(auctionId, amountXlm);
    await this.verifyBalance(dto.publicKey, amountXlm);

    // Submit to Soroban if contract is configured; otherwise fall back to DB-only
    const sorobanResult = await this.submitBidToSoroban(
      auctionId,
      dto.publicKey,
      amountInStroops,
    );

    // Persist bid with Soroban metadata
    const bid = this.bidRepo.create({
      auctionId,
      bidderId,
      amount: amountXlm,
      amountXlm: dto.amount,
      stellarPublicKey: dto.publicKey,
      txHash: sorobanResult.txHash,
      ledgerSequence: sorobanResult.ledgerSequence,
      sorobanStatus: sorobanResult.status,
    });

    await this.bidRepo.save(bid);

    // Update auction current price in DB
    auction.currentPrice = amountXlm;
    await this.auctionRepo.save(auction);

    // Invalidate cached highest bid
    await this.cacheManager.del(`${BID_CACHE_PREFIX}${auctionId}`);

    const event: BidPlacedEvent = {
      auctionId,
      bidderId,
      stellarPublicKey: dto.publicKey,
      amount: amountXlm,
      amountXlm: dto.amount,
      txHash: sorobanResult.txHash,
      ledgerSequence: sorobanResult.ledgerSequence,
      sorobanStatus: sorobanResult.status,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(BID_PLACED_EVENT, event);

    this.logger.log(
      `Bid placed: auction=${auctionId} bidder=${bidderId} amount=${dto.amount} XLM ` +
        `status=${sorobanResult.status} txHash=${sorobanResult.txHash ?? 'n/a'}`,
    );

    return bid;
  }

  async getBidsByAuction(
    auctionId: string,
    query: BidQueryDto,
  ): Promise<BidListResult> {
    await this.loadActiveAuction(auctionId);

    const limit = query.limit ?? 20;

    const qb = this.bidRepo
      .createQueryBuilder('b')
      .where('b.auctionId = :auctionId', { auctionId })
      .orderBy('b.ledgerSequence', 'DESC', 'NULLS LAST')
      .addOrderBy('b.createdAt', 'DESC')
      .take(limit + 1);

    if (query.cursor !== undefined) {
      qb.andWhere('(b.ledgerSequence IS NULL OR b.ledgerSequence < :cursor)', {
        cursor: query.cursor,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    const total = await this.bidRepo.count({ where: { auctionId } });
    const nextCursor =
      hasMore && data[data.length - 1]?.ledgerSequence
        ? (data[data.length - 1].ledgerSequence as number)
        : undefined;

    return {
      data: data as unknown as BidListResult['data'],
      nextCursor,
      total,
    };
  }

  async getHighestBid(auctionId: string): Promise<HighestBidResult> {
    const cacheKey = `${BID_CACHE_PREFIX}${auctionId}`;

    const cached = await this.cacheManager.get<HighestBidResult>(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    // Try to query from Soroban contract first
    const contractResult = await this.queryHighestBidFromContract(auctionId);
    if (contractResult) {
      await this.cacheManager.set(cacheKey, contractResult, BID_CACHE_TTL_S);
      return { ...contractResult, fromCache: false };
    }

    // Fall back to DB
    const highest = await this.bidRepo.findOne({
      where: { auctionId },
      order: { amount: 'DESC' },
    });

    if (!highest) {
      throw new NotFoundException(`No bids found for auction ${auctionId}`);
    }

    const result: HighestBidResult = {
      auctionId,
      amount: Number(highest.amount),
      amountXlm: highest.amountXlm ?? String(highest.amount),
      bidderId: highest.bidderId,
      stellarPublicKey: highest.stellarPublicKey,
      txHash: highest.txHash,
      ledgerSequence: highest.ledgerSequence ?? undefined,
      fromCache: false,
    };

    await this.cacheManager.set(cacheKey, result, BID_CACHE_TTL_S);
    return result;
  }

  async getMyBids(auctionId: string, userId: string): Promise<Bid[]> {
    return this.bidRepo.find({
      where: { auctionId, bidderId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Internal Validation ─────────────────────────────────────────────────────

  private async loadActiveAuction(auctionId: string): Promise<Auction> {
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new BadRequestException(
        `Auction is not active (status: ${auction.status})`,
      );
    }
    if (new Date(auction.endTime) <= new Date()) {
      throw new BadRequestException('Auction has expired');
    }
    return auction;
  }

  private verifySignature(auctionId: string, dto: PlaceBidDto): void {
    const message = `bid:${auctionId}:${dto.amount}`;
    const valid = this.stellarStrategy.verifySignedMessage(
      dto.publicKey,
      message,
      dto.signature,
    );
    if (!valid) {
      throw new ForbiddenException('Invalid Stellar wallet signature');
    }
  }

  private async validateBidAmount(
    auctionId: string,
    amountXlm: number,
  ): Promise<void> {
    const highest = await this.bidRepo.findOne({
      where: { auctionId },
      order: { amount: 'DESC' },
    });

    const currentHighest = highest
      ? Number(highest.amount)
      : Number(
          (await this.auctionRepo.findOne({ where: { id: auctionId } }))
            ?.currentPrice ?? 0,
        );

    const minRequired = currentHighest + currentHighest * BID_MIN_INCREMENT_PCT;
    const absoluteMin = currentHighest + 0.0000001; // at least 1 stroop above

    const threshold = Math.max(minRequired, absoluteMin);

    if (amountXlm < threshold) {
      throw new BadRequestException(
        `Bid must be at least ${threshold.toFixed(7)} XLM ` +
          `(5% above current highest bid of ${currentHighest.toFixed(7)} XLM)`,
      );
    }
  }

  private async verifyBalance(
    publicKey: string,
    requiredXlm: number,
  ): Promise<void> {
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ??
      'https://horizon-testnet.stellar.org';

    try {
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(publicKey);

      const nativeBalance = account.balances.find(
        (b): b is Horizon.HorizonApi.BalanceLineNative =>
          b.asset_type === 'native',
      );

      const xlmBalance = parseFloat(nativeBalance?.balance ?? '0');
      // Keep 1 XLM reserve for Stellar minimum balance requirement
      const available = xlmBalance - 1;

      if (available < requiredXlm) {
        throw new BadRequestException(
          `Insufficient XLM balance. Available: ${available.toFixed(7)} XLM, Required: ${requiredXlm} XLM`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(
        `Balance check failed for ${publicKey}: ${(err as Error).message}. Proceeding.`,
      );
    }
  }

  private async enforceRateLimit(userId: string): Promise<void> {
    const key = `${BID_RATE_LIMIT_PREFIX}${userId}`;
    const windowKey = `${key}:window`;

    const raw = await this.cacheManager.get<string>(windowKey);
    const count =
      raw !== null && raw !== undefined ? parseInt(String(raw), 10) : 0;

    if (count >= BID_RATE_LIMIT_MAX) {
      throw new HttpException(
        `Maximum ${BID_RATE_LIMIT_MAX} bids per minute exceeded`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cacheManager.set(
      windowKey,
      String(count + 1),
      BID_RATE_LIMIT_WINDOW_S,
    );
  }

  // ─── Soroban Integration ─────────────────────────────────────────────────────

  private async submitBidToSoroban(
    auctionId: string,
    bidderPublicKey: string,
    amountInStroops: number,
  ): Promise<{
    txHash?: string;
    ledgerSequence?: number;
    status: BidSorobanStatus;
  }> {
    const contractId = this.configService.get<string>('AUCTION_CONTRACT_ID');

    if (!contractId) {
      this.logger.debug(
        'AUCTION_CONTRACT_ID not configured — skipping Soroban submission',
      );
      return { status: BidSorobanStatus.SKIPPED };
    }

    const sorobanRpcUrl =
      this.configService.get<string>('SOROBAN_RPC_URL') ??
      'https://soroban-testnet.stellar.org';

    const networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE') ??
      Networks.TESTNET;

    try {
      const server = new SorobanServer(sorobanRpcUrl);
      const account = await server.getAccount(bidderPublicKey);

      const contract = new Contract(contractId);

      const operation = contract.call(
        'place_bid',
        // auction_id as bytes
        nativeToScVal(Buffer.from(auctionId), { type: 'bytes' }),
        // bidder address
        Address.fromString(bidderPublicKey).toScVal(),
        // amount as i128 (stroops)
        nativeToScVal(BigInt(amountInStroops), { type: 'i128' }),
      );

      const txBuilder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(30);

      const tx = txBuilder.build();

      // Simulate first for fee estimation
      const simResult = await server.simulateTransaction(tx);
      if ('error' in simResult) {
        this.logger.error(`Soroban simulation error: ${simResult.error}`);
        return { status: BidSorobanStatus.FAILED };
      }

      this.logger.debug(
        `Soroban simulation OK. Estimated fee: ${JSON.stringify((simResult as { minResourceFee?: string }).minResourceFee)}`,
      );

      // Note: actual submission requires a signed transaction.
      // The frontend must sign the XDR and call a confirm endpoint, or
      // a backend signing key (AUCTION_SIGNING_SECRET) must be configured.
      const signingSecret = this.configService.get<string>(
        'AUCTION_SIGNING_SECRET',
      );

      if (!signingSecret) {
        this.logger.debug(
          'AUCTION_SIGNING_SECRET not configured — simulation only, not submitting',
        );
        return { status: BidSorobanStatus.PENDING };
      }

      const { Keypair } = await import('stellar-sdk');
      const { assembleTransaction } = await import('stellar-sdk/rpc');

      const keypair = Keypair.fromSecret(signingSecret);

      const assembledBuilder = assembleTransaction(tx, simResult);
      const finalTx = assembledBuilder.build();
      finalTx.sign(keypair);

      const sendResult = await server.sendTransaction(finalTx);

      if (sendResult.status === 'ERROR') {
        this.logger.error(
          `Soroban submission error: ${JSON.stringify(sendResult.errorResult)}`,
        );
        return { status: BidSorobanStatus.FAILED };
      }

      this.logger.log(
        `Soroban bid submitted: txHash=${sendResult.hash} status=${sendResult.status}`,
      );

      // Poll for confirmation (up to 5 attempts x 2s)
      let confirmed = false;
      let ledgerSequence: number | undefined;

      for (let i = 0; i < 5; i++) {
        await new Promise<void>((r) => setTimeout(r, 2000));
        const txStatusResult: unknown = await server.getTransaction(
          sendResult.hash,
        );
        if (!txStatusResult || typeof txStatusResult !== 'object') {
          continue;
        }

        const txStatus = txStatusResult as {
          status?: unknown;
          ledger?: number;
        };

        if (String(txStatus.status) === 'SUCCESS') {
          ledgerSequence = txStatus.ledger;
          confirmed = true;
          break;
        }
        if (String(txStatus.status) === 'FAILED') {
          return { txHash: sendResult.hash, status: BidSorobanStatus.FAILED };
        }
      }

      return {
        txHash: sendResult.hash,
        ledgerSequence,
        status: confirmed
          ? BidSorobanStatus.CONFIRMED
          : BidSorobanStatus.PENDING,
      };
    } catch (err) {
      this.logger.error(
        `Soroban bid submission failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return { status: BidSorobanStatus.FAILED };
    }
  }

  private async queryHighestBidFromContract(
    auctionId: string,
  ): Promise<HighestBidResult | null> {
    const contractId = this.configService.get<string>('AUCTION_CONTRACT_ID');
    if (!contractId) return null;

    const sorobanRpcUrl =
      this.configService.get<string>('SOROBAN_RPC_URL') ??
      'https://soroban-testnet.stellar.org';

    try {
      const server = new SorobanServer(sorobanRpcUrl);

      const { scValToNative } = await import('stellar-sdk');

      const keyVal = nativeToScVal(Buffer.from(auctionId), { type: 'bytes' });

      const data = await server.getContractData(
        contractId,
        keyVal,
        // Persistent durability for auction state
        (await import('stellar-sdk/rpc')).Durability.Persistent,
      );

      if (!data) return null;

      // data.val is xdr.LedgerEntryData; extract the ScVal from the contract data entry
      const scVal = data.val.contractData().val();
      const native: unknown = scValToNative(scVal);

      if (
        native &&
        typeof native === 'object' &&
        'highest_bidder' in (native as Record<string, unknown>) &&
        'highest_bid' in (native as Record<string, unknown>)
      ) {
        const obj = native as Record<string, unknown>;
        const amountStroops = Number(obj.highest_bid ?? 0);
        const amountXlm = (amountStroops / STROOPS_PER_XLM).toFixed(7);
        const highestBidder = obj.highest_bidder;
        const bidderId = typeof highestBidder === 'string' ? highestBidder : '';

        return {
          auctionId,
          amount: amountStroops,
          amountXlm,
          bidderId,
          fromCache: false,
        };
      }

      return null;
    } catch (err) {
      this.logger.debug(
        `Contract highest-bid query failed for ${auctionId}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
