import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Bid } from './entities/bid.entity';
import { Auction } from './entities/auction.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidQueryDto } from './dto/bid-query.dto';
import {
  SorobanRpcService,
  xlmToStroops,
  stroopsToXlm,
  HighestBidResult,
} from '../soroban/soroban-rpc.service';
import { ConfigService } from '@nestjs/config';
import { Transaction, Networks } from 'stellar-sdk';

const HIGHEST_BID_CACHE_TTL_MS = 30_000;
const RATE_LIMIT_BIDS_PER_MINUTE = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);
  private readonly horizonUrl: string;
  private readonly networkPassphrase: string;
  /** In-memory rate limit: publicKey -> timestamps of recent bid attempts */
  private readonly rateLimitMap = new Map<string, number[]>();

  constructor(
    @InjectRepository(Bid) private readonly bidRepo: Repository<Bid>,
    @InjectRepository(Auction) private readonly auctionRepo: Repository<Auction>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly sorobanRpc: SorobanRpcService,
    private readonly configService: ConfigService,
  ) {
    this.horizonUrl =
      this.configService.get<string>('HORIZON_URL') ?? 'https://horizon-testnet.stellar.org';
    this.networkPassphrase =
      this.configService.get<string>('NETWORK_PASSPHRASE') ?? Networks.TESTNET;
  }

  async placeBid(
    auctionId: string,
    dto: PlaceBidDto,
    bidderPublicKey: string,
  ): Promise<{ transactionHash: string; ledgerSequence?: number }> {
    const auction = await this.auctionRepo.findOne({ where: { auctionId } });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }
    if (auction.status !== 'Active') {
      throw new BadRequestException('Auction is not active');
    }
    if (auction.sellerPublicKey === bidderPublicKey) {
      throw new ForbiddenException('Cannot bid on your own auction');
    }

    this.enforceRateLimit(bidderPublicKey);

    const amountXlm = dto.amount;
    const amountStroops = xlmToStroops(amountXlm);

    const highest = await this.getHighestBid(auctionId);
    const minAmountStroops = this.computeMinNextBidStroops(
      highest?.amountStroops ?? '0',
      auction.minIncrement,
    );
    if (BigInt(amountStroops.toString()) < BigInt(minAmountStroops)) {
      throw new BadRequestException(
        `Bid must be at least ${stroopsToXlm(minAmountStroops)} XLM (min increment)`,
      );
    }

    await this.checkSufficientBalance(bidderPublicKey, amountXlm);

    if (!dto.signedTransactionXdr) {
      throw new BadRequestException(
        'signedTransactionXdr is required. Sign the place_bid transaction with your wallet and include it in the request.',
      );
    }

    const tx = this.parseAndVerifySignedTransaction(
      dto.signedTransactionXdr,
      bidderPublicKey,
      auctionId,
      amountStroops.toString(),
    );

    const sim = await this.sorobanRpc.simulateTransaction(dto.signedTransactionXdr);
    if (!sim.success) {
      throw new BadRequestException(sim.error?.message ?? 'Transaction simulation failed');
    }

    const result = await this.sorobanRpc.sendTransaction(dto.signedTransactionXdr);
    if ('error' in result) {
      throw new BadRequestException(result.error.message);
    }

    const confirmed = await this.sorobanRpc.waitForTransaction(result.hash);
    const ledgerSequence = confirmed ? await this.sorobanRpc.getLatestLedger() : undefined;

    await this.invalidateHighestBidCache(auctionId);

    return { transactionHash: result.hash, ledgerSequence };
  }

  async getBidsByAuction(auctionId: string, query: BidQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);
    const qb = this.bidRepo
      .createQueryBuilder('b')
      .where('b.auctionId = :auctionId', { auctionId })
      .orderBy('b.ledgerSequence', 'DESC')
      .take(limit);

    if (query.cursor != null && query.cursor > 0) {
      qb.andWhere('b.ledgerSequence < :cursor', { cursor: query.cursor });
    }

    const items = await qb.getMany();
    const nextCursor =
      items.length === limit && items.length > 0 ? items[items.length - 1].ledgerSequence : null;
    return {
      items: items.map((b) => ({
        id: b.id,
        auctionId: b.auctionId,
        bidderPublicKey: b.bidderPublicKey,
        amountXlm: b.amountXlm,
        amountStroops: b.amountStroops,
        transactionHash: b.transactionHash,
        ledgerSequence: b.ledgerSequence,
        createdAt: b.createdAt,
      })),
      nextCursor,
    };
  }

  async getHighestBid(auctionId: string): Promise<HighestBidResult | null> {
    const cacheKey = `bids:highest:${auctionId}`;
    const cached = await this.cache.get<HighestBidResult>(cacheKey);
    if (cached) return cached;

    const fromContract = await this.sorobanRpc.getHighestBidFromContract(auctionId);
    if (fromContract) {
      await this.cache.set(cacheKey, fromContract, HIGHEST_BID_CACHE_TTL_MS);
      return fromContract;
    }

    const fromDb = await this.bidRepo.findOne({
      where: { auctionId },
      order: { ledgerSequence: 'DESC' },
    });
    if (!fromDb) return null;
    const result: HighestBidResult = {
      bidder: fromDb.bidderPublicKey,
      amountStroops: fromDb.amountStroops,
      amountXlm: fromDb.amountXlm,
      ledgerSequence: fromDb.ledgerSequence,
    };
    await this.cache.set(cacheKey, result, HIGHEST_BID_CACHE_TTL_MS);
    return result;
  }

  async getMyBids(auctionId: string, userPublicKey: string) {
    return this.bidRepo.find({
      where: { auctionId, bidderPublicKey: userPublicKey },
      order: { ledgerSequence: 'DESC' },
    });
  }

  async upsertBidFromEvent(data: {
    auctionId: string;
    bidderPublicKey: string;
    amountStroops: string;
    transactionHash: string;
    ledgerSequence: number;
  }): Promise<Bid> {
    const amountXlm = stroopsToXlm(data.amountStroops);
    let bid = await this.bidRepo.findOne({
      where: {
        auctionId: data.auctionId,
        transactionHash: data.transactionHash,
      },
    });
    if (bid) return bid;
    bid = this.bidRepo.create({
      auctionId: data.auctionId,
      bidderPublicKey: data.bidderPublicKey,
      amountXlm,
      amountStroops: data.amountStroops,
      transactionHash: data.transactionHash,
      ledgerSequence: data.ledgerSequence,
    });
    return this.bidRepo.save(bid);
  }

  async invalidateHighestBidCache(auctionId: string): Promise<void> {
    await this.cache.del(`bids:highest:${auctionId}`);
  }

  private enforceRateLimit(publicKey: string): void {
    const now = Date.now();
    let timestamps = this.rateLimitMap.get(publicKey) ?? [];
    timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (timestamps.length >= RATE_LIMIT_BIDS_PER_MINUTE) {
      throw new BadRequestException('Rate limit exceeded: maximum 5 bids per minute');
    }
    timestamps.push(now);
    this.rateLimitMap.set(publicKey, timestamps);
  }

  private computeMinNextBidStroops(
    currentHighestStroops: string,
    minIncrement: string,
  ): string {
    const current = BigInt(currentHighestStroops);
    if (current === 0n) return currentHighestStroops;
    const inc = parseFloat(minIncrement);
    if (inc <= 0) return (current + 1n).toString();
    if (inc <= 1) {
      const next = (current * BigInt(Math.ceil(inc * 1e7)) + 9999999n) / 10000000n;
      return next.toString();
    }
    const fixedStroops = xlmToStroops(minIncrement.toString());
    return (current + BigInt(fixedStroops.toString())).toString();
  }

  private async checkSufficientBalance(publicKey: string, amountXlm: string): Promise<void> {
    try {
      const res = await fetch(`${this.horizonUrl}/accounts/${publicKey}`);
      if (!res.ok) {
        this.logger.warn(`Horizon account fetch failed: ${res.status}`);
        return;
      }
      const acc = (await res.json()) as { balances?: Array< { balance: string; asset_type: string }> };
      const xlm = acc.balances?.find((b) => b.asset_type === 'native');
      if (!xlm) {
        throw new BadRequestException('Insufficient XLM balance');
      }
      const balance = parseFloat(xlm.balance);
      const required = parseFloat(amountXlm);
      if (balance < required) {
        throw new BadRequestException('Insufficient XLM balance');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.warn(`Balance check failed: ${(e as Error).message}`);
    }
  }

  private parseAndVerifySignedTransaction(
    envelopeXdr: string,
    expectedSource: string,
    expectedAuctionId: string,
    expectedAmountStroops: string,
  ): Transaction {
    let tx: Transaction;
    try {
      tx = new Transaction(envelopeXdr, this.networkPassphrase);
    } catch {
      throw new BadRequestException('Invalid transaction XDR');
    }
    if (tx.source !== expectedSource) {
      throw new BadRequestException('Transaction source does not match signing key');
    }
    if (!tx.signatures?.length) {
      throw new BadRequestException('Transaction is not signed');
    }
    return tx;
  }

  async findAuction(auctionId: string): Promise<Auction | null> {
    return this.auctionRepo.findOne({ where: { auctionId } });
  }
}
