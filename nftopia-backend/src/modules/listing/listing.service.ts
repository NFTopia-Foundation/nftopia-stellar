import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Listing } from './entities/listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { BuyNftDto } from './dto/buy-nft.dto';
import { ListingStatus } from './interfaces/listing.interface';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { CreateSaleParams } from '../shared/contracts/marketplace-settlement.types';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionState } from '../transaction/enums/transaction-state.enum';
import { Transaction } from '../transaction/entities/transaction.entity';
import { PaymentMethod } from '../payment/enums/payment-method.enum';
import {
  ListingUnavailableException,
  ListingUnavailableReason,
} from './exceptions/listing-unavailable.exception';

type ListingCursorPayload = {
  createdAt: string;
  id: string;
};

/**
 * How long a purchase reservation may stay open before the sweeper in
 * `expireListings()` releases it. Guards against a process that crashed
 * between claiming a listing and reporting the settlement outcome, and against
 * off-chain payment intents that are never confirmed. Overridable with
 * `LISTING_RESERVATION_TTL_SECONDS`.
 */
const DEFAULT_LISTING_RESERVATION_TTL_SECONDS = 30 * 60;

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(StellarNft)
    private readonly nftRepo: Repository<StellarNft>,
    private readonly configService: ConfigService,
    private readonly settlementClient: MarketplaceSettlementClient,
    private readonly transactionService: TransactionService,
    private readonly eventEmitter: EventEmitter2,
    /**
     * Used to run the purchase claim (availability check + reservation write)
     * inside a single database transaction with a row-level lock.
     */
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateListingDto, sellerId: string) {
    if (dto.price <= 0) throw new BadRequestException('Price must be positive');

    // Feature flag: use contract if enabled
    const enableOnchain = this.configService.get<boolean>(
      'ENABLE_ONCHAIN_SETTLEMENT',
    );
    if (enableOnchain) {
      // Call contract to create sale
      const params: CreateSaleParams = {
        seller: sellerId,
        nftContract: dto.nftContractId,
        tokenId: dto.nftTokenId,
        price: String(dto.price),
        currency: dto.currency || 'XLM',
        durationSeconds: dto.expiresAt
          ? Math.floor((new Date(dto.expiresAt).getTime() - Date.now()) / 1000)
          : 0,
      };
      const saleId = await this.settlementClient.createSale(params);
      // Optionally, sync to DB or return contract result
      // For GraphQL compatibility, return a Listing object (mock or DB-backed)
      const listing = this.listingRepo.create({
        nftContractId: dto.nftContractId,
        nftTokenId: dto.nftTokenId,
        sellerId,
        price: dto.price,
        currency: dto.currency || 'XLM',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        status: ListingStatus.ACTIVE,
        // Optionally, add a field for contract saleId if needed
      });
      // This branch doesn't persist a row (no DB-generated id yet), so the
      // on-chain sale id is the only stable identifier available for
      // moderation to reference.
      this.emitListingCreated({
        listingId: String(saleId),
        sellerId,
        nftContractId: dto.nftContractId,
        nftTokenId: dto.nftTokenId,
      });
      return listing;
    }

    // Legacy DB logic
    // prevent duplicate active listing for same nft
    const existing = await this.listingRepo.findOne({
      where: {
        nftContractId: dto.nftContractId,
        nftTokenId: dto.nftTokenId,
        status: ListingStatus.ACTIVE,
      },
    });
    if (existing) throw new BadRequestException('NFT already listed');

    const nft = await this.nftRepo.findOne({
      where: { contractId: dto.nftContractId, tokenId: dto.nftTokenId },
    });
    if (!nft) throw new NotFoundException('NFT not found');

    const listing = this.listingRepo.create({
      nftContractId: dto.nftContractId,
      nftTokenId: dto.nftTokenId,
      sellerId,
      price: dto.price,
      currency: dto.currency || 'XLM',
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      status: ListingStatus.ACTIVE,
    });

    const saved = await this.listingRepo.save(listing);
    this.emitListingCreated({
      listingId: saved.id,
      sellerId,
      nftContractId: dto.nftContractId,
      nftTokenId: dto.nftTokenId,
    });
    return saved;
  }

  /**
   * Fires off-critical-path so a slow or throwing listener (e.g. the
   * moderation queue enqueue) never delays or fails the create() response —
   * mirrors NftService.emitSearchEvent.
   */
  private emitListingCreated(payload: {
    listingId: string;
    sellerId: string;
    nftContractId: string;
    nftTokenId: string;
  }) {
    setImmediate(() => {
      this.eventEmitter.emit('listing.created', payload);
    });
  }

  async findAll(query?: {
    status?: ListingStatus;
    sellerId?: string;
    nftContractId?: string;
    nftTokenId?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.listingRepo.createQueryBuilder('l');
    if (query?.status)
      qb.andWhere('l.status = :status', { status: query.status });
    if (query?.sellerId)
      qb.andWhere('l.sellerId = :sellerId', { sellerId: query.sellerId });
    if (query?.nftContractId)
      qb.andWhere('l.nftContractId = :nftContractId', {
        nftContractId: query.nftContractId,
      });
    if (query?.nftTokenId)
      qb.andWhere('l.nftTokenId = :nftTokenId', {
        nftTokenId: query.nftTokenId,
      });

    // Active listings should be non-expired — ensure `status` is typed before enum comparisons
    const status = query?.status;
    if (status === ListingStatus.ACTIVE || status == null) {
      qb.andWhere('l.expiresAt IS NULL OR l.expiresAt > :now', {
        now: new Date(),
      });
    }

    const page = Number(query?.page ?? 1);
    const limit = Number(query?.limit ?? 20);
    qb.skip((page - 1) * limit).take(limit);

    return qb.getMany();
  }

  async findConnection(query: {
    first: number;
    after?: ListingCursorPayload;
    status?: ListingStatus;
    sellerId?: string;
    nftContractId?: string;
    nftTokenId?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    category?: string;
    sortBy?: string;
  }): Promise<{
    data: Listing[];
    total: number;
    hasNextPage: boolean;
  }> {
    const qb = this.listingRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect(
        'StellarNft',
        'nft',
        'nft.contractId = l.nftContractId AND nft.tokenId = l.nftTokenId',
      );

    this.applyFilters(qb, query);

    // Apply sorting
    if (query.sortBy) {
      switch (query.sortBy) {
        case 'price_asc':
          qb.orderBy('l.price', 'ASC');
          break;
        case 'price_desc':
          qb.orderBy('l.price', 'DESC');
          break;
        case 'oldest':
          qb.orderBy('l.createdAt', 'ASC');
          break;
        case 'newest':
        default:
          qb.orderBy('l.createdAt', 'DESC');
          break;
      }
    } else {
      qb.orderBy('l.createdAt', 'DESC');
    }
    qb.addOrderBy('l.id', 'DESC');

    if (query.after) {
      qb.andWhere(
        '(l.createdAt < :afterCreatedAt OR (l.createdAt = :afterCreatedAt AND l.id < :afterId))',
        {
          afterCreatedAt: query.after.createdAt,
          afterId: query.after.id,
        },
      );
    }

    const totalQb = this.listingRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect(
        'StellarNft',
        'nft',
        'nft.contractId = l.nftContractId AND nft.tokenId = l.nftTokenId',
      );
    this.applyFilters(totalQb, query);

    const [rows, total] = await Promise.all([
      qb.take(query.first + 1).getMany(),
      totalQb.getCount(),
    ]);

    return {
      data: rows.slice(0, query.first),
      total,
      hasNextPage: rows.length > query.first,
    };
  }

  private applyFilters(
    qb: ReturnType<Repository<Listing>['createQueryBuilder']>,
    query: {
      status?: ListingStatus;
      sellerId?: string;
      nftContractId?: string;
      nftTokenId?: string;
      search?: string;
      minPrice?: number;
      maxPrice?: number;
      category?: string;
    },
  ) {
    if (query.status) {
      qb.andWhere('l.status = :status', { status: query.status });
    }
    if (query.sellerId) {
      qb.andWhere('l.sellerId = :sellerId', { sellerId: query.sellerId });
    }
    if (query.nftContractId) {
      qb.andWhere('l.nftContractId = :nftContractId', {
        nftContractId: query.nftContractId,
      });
    }
    if (query.nftTokenId) {
      qb.andWhere('l.nftTokenId = :nftTokenId', {
        nftTokenId: query.nftTokenId,
      });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('l.price >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('l.price <= :maxPrice', { maxPrice: query.maxPrice });
    }
    if (query.search) {
      qb.andWhere('(nft.name ILIKE :search OR nft.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.category) {
      // Assuming collection or attributes would hold category. This is a basic placeholder.
      // Might require joining collections table depending on actual schema.
    }

    const status = query.status;
    if (status === ListingStatus.ACTIVE || status == null) {
      qb.andWhere('(l.expiresAt IS NULL OR l.expiresAt > :now)', {
        now: new Date(),
      });
    }
  }

  async findOne(id: string) {
    const listing = await this.listingRepo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async findByNft(contractId: string, tokenId: string) {
    return this.listingRepo.find({
      where: { nftContractId: contractId, nftTokenId: tokenId },
    });
  }

  async findByNFTIds(nftIds: string[]): Promise<Listing[]> {
    const uniqueNftIds = [...new Set(nftIds.filter(Boolean))];
    if (!uniqueNftIds.length) {
      return [];
    }

    const parsed = uniqueNftIds
      .map((nftId) => {
        const [contractId, tokenId] = nftId.split(':');
        if (!contractId || !tokenId) {
          return null;
        }

        return { contractId, tokenId };
      })
      .filter(
        (value): value is { contractId: string; tokenId: string } =>
          value !== null,
      );

    if (!parsed.length) {
      return [];
    }

    const qb = this.listingRepo
      .createQueryBuilder('l')
      .where(
        new Brackets((where) => {
          parsed.forEach(({ contractId, tokenId }, index) => {
            where.orWhere(
              `(l.nftContractId = :contractId${index} AND l.nftTokenId = :tokenId${index})`,
              {
                [`contractId${index}`]: contractId,
                [`tokenId${index}`]: tokenId,
              },
            );
          });
        }),
      )
      .andWhere('l.status = :status', { status: ListingStatus.ACTIVE })
      .andWhere('(l.expiresAt IS NULL OR l.expiresAt > :now)', {
        now: new Date(),
      });

    return qb.getMany();
  }

  async cancel(id: string, callerId: string) {
    const listing = await this.findOne(id);
    if (listing.sellerId !== callerId)
      throw new ForbiddenException('Only seller can cancel');
    const ls = listing.status as ListingStatus;
    if (ls !== ListingStatus.ACTIVE)
      throw new BadRequestException('Listing not active');

    if (listing.reservedAt) {
      throw new ListingUnavailableException(
        id,
        ListingUnavailableReason.RESERVED,
        'a purchase is currently in flight',
      );
    }

    // Conditional update rather than `save()`: a purchase that claims the
    // listing between the read above and this write must win the race instead
    // of being cancelled out from under the buyer.
    const result = await this.listingRepo.update(
      { id, status: ListingStatus.ACTIVE, reservedAt: IsNull() },
      { status: ListingStatus.CANCELLED },
    );
    if (!result.affected) {
      throw new ListingUnavailableException(
        id,
        ListingUnavailableReason.RESERVED,
        'a purchase started while the cancellation was being processed',
      );
    }

    return this.findOne(id);
  }

  /**
   * Buy an NFT with payment method support
   * Handles different payment methods:
   * - XLM/USDC: On-chain settlement via Soroban
   * - BUNDLE: Apply bundle discount logic
   * - CREDIT_CARD/STRIPE: Off-chain payment flow with webhook confirmation
   *
   * Concurrency: the listing is *claimed* first (see `claimListing`) with an
   * atomic availability check inside a row-locked transaction. Only the winner
   * of two simultaneous buyers ever reaches settlement, so a listing yields
   * exactly one success and can never trigger duplicate on-chain settlement.
   * The loser gets a 409 `LISTING_UNAVAILABLE` with reason `RESERVED`.
   */
  async buy(id: string, buyerId: string, dto?: BuyNftDto) {
    // Determine payment method with default
    const paymentMethod = dto?.paymentMethod || PaymentMethod.XLM;

    // Validate the payment method *before* claiming, so a malformed request can
    // never leave a reservation behind.
    this.validatePaymentMethod(paymentMethod, dto);

    // Atomic availability check + reservation. Throws when the buyer lost the
    // race, or the listing is not active / expired / already reserved.
    const listing = await this.claimListing(id, buyerId);
    const finalPrice = this.calculateFinalPrice(listing.price, dto);

    let transaction: Transaction | undefined;
    try {
      transaction = await this.settleListingPurchase(id, listing, buyerId, dto);
    } catch (error) {
      // Settlement never committed - hand the listing back to the marketplace
      // so a failed purchase does not strand it.
      await this.releaseReservation(id, buyerId);
      throw error;
    }

    if (transaction?.state === TransactionState.COMPLETED) {
      await this.markListingSold(id);
    } else if (
      transaction?.state === TransactionState.FAILED ||
      transaction?.state === TransactionState.CANCELLED ||
      transaction?.state === TransactionState.ROLLED_BACK
    ) {
      await this.releaseReservation(id, buyerId);
    }
    // PENDING (credit card / Stripe) intentionally keeps the reservation until
    // the payment webhook confirms or fails; releasing it early would let a
    // second buyer pay for an NFT that is already being paid for.

    return {
      success: transaction?.state === TransactionState.COMPLETED,
      listingId: id,
      buyer: buyerId,
      transactionId: transaction?.id,
      transactionState: transaction?.state,
      paymentMethod,
      amount: finalPrice,
    };
  }

  /**
   * Payment-method specific settlement dispatch. Extracted so `buy()` stays
   * readable around its claim/release bookkeeping.
   */
  private async settleListingPurchase(
    id: string,
    listing: Listing,
    buyerId: string,
    dto?: BuyNftDto,
  ): Promise<Transaction | undefined> {
    const paymentMethod = dto?.paymentMethod || PaymentMethod.XLM;
    const finalPrice = this.calculateFinalPrice(listing.price, dto);
    const tokenAddress = dto?.tokenAddress;

    switch (paymentMethod) {
      case PaymentMethod.XLM:
      case PaymentMethod.USDC: {
        // On-chain settlement via Soroban
        // USDC requires token address
        if (paymentMethod === PaymentMethod.USDC && !tokenAddress) {
          throw new BadRequestException(
            'tokenAddress is required for USDC payments',
          );
        }
        // For XLM/USDC payments
        return this.transactionService.createAndExecuteListingPurchaseWithPayment(
          id, // listingId
          buyerId, // buyerId
          paymentMethod, // paymentMethod
          tokenAddress, // tokenAddress
          undefined, // maxGas (optional)
        );
      }

      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.STRIPE: {
        // Off-chain payment flow
        // Create transaction in PENDING state, trigger payment gateway
        if (!dto?.stripePaymentIntentId) {
          throw new BadRequestException(
            'stripePaymentIntentId is required for credit card/stripe payments',
          );
        }
        return this.transactionService.createOffchainPaymentTransaction(
          id,
          buyerId,
          {
            amount: finalPrice,
            paymentMethod,
            stripePaymentIntentId: dto.stripePaymentIntentId,
            paymentIntentSecret: dto.paymentIntentSecret,
          },
        );
      }

      case PaymentMethod.BUNDLE: {
        // Bundle discount logic
        if (!dto?.bundleItemIds || dto.bundleItemIds.length === 0) {
          throw new BadRequestException(
            'bundleItemIds are required for bundle payments',
          );
        }
        return this.transactionService.createAndExecuteBundlePurchase(
          id,
          buyerId,
          {
            amount: finalPrice,
            paymentMethod,
            bundleItemIds: dto.bundleItemIds,
            discountPercentage: dto.discountPercentage || 0,
          },
        );
      }

      default:
        throw new BadRequestException(
          `Unsupported payment method: ${String(paymentMethod)}`,
        );
    }
  }

  /**
   * Atomically claim `listingId` for `buyerId`.
   *
   * The availability check *and* the reservation write happen inside a single
   * database transaction that holds a row-level `SELECT ... FOR UPDATE` lock on
   * the listing row. That is what makes concurrent buyers mutually exclusive:
   * the first to take the lock sets `reservedAt`, the second blocks on the
   * lock, then observes `reservedAt` set and is rejected.
   *
   * The lock is released as soon as this short transaction commits - the slow
   * Soroban settlement deliberately runs *outside* it, so a pooled connection is
   * never held open across a network round trip (and we cannot deadlock against
   * `TransactionService`, which writes to the same row while settling). This is
   * still safe: the reservation is durable *before* settlement is attempted,
   * which is exactly what prevents duplicate on-chain settlement.
   *
   * `status` is intentionally left ACTIVE so the downstream settlement call -
   * which only accepts ACTIVE listings - still works.
   */
  private async claimListing(id: string, buyerId: string): Promise<Listing> {
    return this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Listing, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      const status = listing.status as ListingStatus;
      if (status !== ListingStatus.ACTIVE) {
        throw new ListingUnavailableException(
          id,
          ListingUnavailableReason.NOT_ACTIVE,
          `current status is ${status}`,
        );
      }

      if (listing.reservedAt) {
        throw new ListingUnavailableException(
          id,
          ListingUnavailableReason.RESERVED,
          'another buyer has already claimed this listing',
        );
      }

      if (listing.expiresAt && new Date(listing.expiresAt) <= new Date()) {
        // Not persisted here: throwing rolls the transaction back, and the
        // expiry cron owns the ACTIVE -> EXPIRED transition.
        throw new ListingUnavailableException(
          id,
          ListingUnavailableReason.EXPIRED,
        );
      }

      listing.reservedAt = new Date();
      listing.reservedBy = buyerId;
      return manager.save(Listing, listing);
    });
  }

  /**
   * Clear a reservation held by `buyerId`, returning the listing to the pool.
   * Owner and ACTIVE status are part of the update condition, so a release can
   * never resurrect a listing that has since been sold.
   */
  private async releaseReservation(id: string, buyerId: string): Promise<void> {
    const result = await this.listingRepo.update(
      { id, reservedBy: buyerId, status: ListingStatus.ACTIVE },
      { reservedAt: null, reservedBy: null },
    );
    if (result.affected) {
      this.logger.log(`Released purchase reservation on listing ${id}`);
    }
  }

  /**
   * Persist the winning outcome of a completed purchase.
   *
   * Deliberately a plain conditional update instead of a version-checked
   * `save()`: settlement already moved the row (it marks the listing SOLD
   * itself), so an optimistic check against our claim-time snapshot would fail
   * spuriously. The reservation makes this write exclusive anyway.
   */
  private async markListingSold(id: string): Promise<void> {
    await this.listingRepo.update(
      { id },
      { status: ListingStatus.SOLD, reservedAt: null, reservedBy: null },
    );
  }

  /**
   * Release purchase reservations that were never resolved - a process that
   * crashed between claiming and reporting, or an off-chain payment intent that
   * was never confirmed - so the listing becomes purchasable again instead of
   * being stranded forever.
   *
   * TTL is `LISTING_RESERVATION_TTL_SECONDS` (default 30 minutes).
   */
  private async releaseStaleReservations(): Promise<void> {
    const configured = Number(
      this.configService.get<string>('LISTING_RESERVATION_TTL_SECONDS'),
    );
    const ttlSeconds =
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_LISTING_RESERVATION_TTL_SECONDS;
    const cutoff = new Date(Date.now() - ttlSeconds * 1000);

    try {
      const stale = await this.listingRepo
        .createQueryBuilder('l')
        .select('l.id', 'id')
        .where('l.status = :status', { status: ListingStatus.ACTIVE })
        .andWhere('l.reservedAt IS NOT NULL')
        .andWhere('l.reservedAt < :cutoff', { cutoff })
        .getRawMany<{ id: string }>();

      if (stale.length === 0) return;

      const result = await this.listingRepo.update(
        { id: In(stale.map((row) => row.id)), status: ListingStatus.ACTIVE },
        { reservedAt: null, reservedBy: null },
      );

      this.logger.warn(
        `Released ${result.affected ?? 0} stale listing reservation(s) older than ${ttlSeconds}s`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to release stale listing reservations: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Calculate final price with potential bundle discount
   */
  private calculateFinalPrice(originalPrice: number, dto?: BuyNftDto): number {
    if (!dto || !dto.discountPercentage || dto.discountPercentage <= 0) {
      return originalPrice;
    }

    const discount = (originalPrice * dto.discountPercentage) / 100;
    return Math.max(0, originalPrice - discount);
  }

  /**
   * Validate payment method and its required fields
   */
  private validatePaymentMethod(
    paymentMethod: PaymentMethod,
    dto?: BuyNftDto,
  ): void {
    const supportedMethods = Object.values(PaymentMethod);
    if (!supportedMethods.includes(paymentMethod)) {
      throw new BadRequestException(
        `Unsupported payment method: ${String(paymentMethod)}. Supported: ${supportedMethods.join(', ')}`,
      );
    }

    // Validate USDC requires token address
    if (paymentMethod === PaymentMethod.USDC && !dto?.tokenAddress) {
      throw new BadRequestException(
        'tokenAddress is required for USDC payments',
      );
    }

    // Validate credit card requires payment intent
    if (
      (paymentMethod === PaymentMethod.CREDIT_CARD ||
        paymentMethod === PaymentMethod.STRIPE) &&
      !dto?.stripePaymentIntentId
    ) {
      throw new BadRequestException(
        'stripePaymentIntentId is required for credit card/stripe payments',
      );
    }

    // Validate bundle requires bundleItemIds
    if (
      paymentMethod === PaymentMethod.BUNDLE &&
      (!dto?.bundleItemIds || dto.bundleItemIds.length === 0)
    ) {
      throw new BadRequestException(
        'bundleItemIds are required for bundle payments',
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireListings() {
    // Recover listings stranded by a crashed/abandoned purchase before expiring
    // anything, so a reservation can never outlive the listing itself.
    await this.releaseStaleReservations();

    this.logger.debug('Checking for expired listings');
    const now = new Date();
    const expired = await this.listingRepo
      .createQueryBuilder('l')
      .where('l.status = :status', { status: ListingStatus.ACTIVE })
      .andWhere('l.expiresAt <= :now', { now })
      .getMany();
    for (const l of expired) {
      try {
        l.status = ListingStatus.EXPIRED;
        await this.listingRepo.save(l);
      } catch (e) {
        this.logger.error(
          `Failed to expire listing ${l.id}: ${(e as Error).message}`,
        );
      }
    }
  }
}
