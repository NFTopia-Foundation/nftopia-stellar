import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Listing } from './entities/listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingStatus } from './interfaces/listing.interface';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { CreateSaleParams } from '../shared/contracts/marketplace-settlement.types';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionState } from '../transaction/enums/transaction-state.enum';

type ListingCursorPayload = {
  createdAt: string;
  id: string;
};

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
      await this.settlementClient.createSale(params);
      // Optionally, sync to DB or return contract result
      // For GraphQL compatibility, return a Listing object (mock or DB-backed)
      return this.listingRepo.create({
        nftContractId: dto.nftContractId,
        nftTokenId: dto.nftTokenId,
        sellerId,
        price: dto.price,
        currency: dto.currency || 'XLM',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        status: ListingStatus.ACTIVE,
        // Optionally, add a field for contract saleId if needed
      });
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

    return this.listingRepo.save(listing);
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
  }): Promise<{
    data: Listing[];
    total: number;
    hasNextPage: boolean;
  }> {
    const qb = this.listingRepo
      .createQueryBuilder('l')
      .orderBy('l.createdAt', 'DESC')
      .addOrderBy('l.id', 'DESC');

    this.applyFilters(qb, query);

    if (query.after) {
      qb.andWhere(
        '(l.createdAt < :afterCreatedAt OR (l.createdAt = :afterCreatedAt AND l.id < :afterId))',
        {
          afterCreatedAt: query.after.createdAt,
          afterId: query.after.id,
        },
      );
    }

    const totalQb = this.listingRepo.createQueryBuilder('l');
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
    listing.status = ListingStatus.CANCELLED;
    return this.listingRepo.save(listing);
  }

  async buy(id: string, buyerId: string) {
    const listing = await this.findOne(id);
    const ls = listing.status as ListingStatus;
    if (ls !== ListingStatus.ACTIVE)
      throw new BadRequestException('Listing not active');
    if (listing.expiresAt && new Date(listing.expiresAt) <= new Date())
      throw new BadRequestException('Listing expired');

    const transaction =
      await this.transactionService.createAndExecuteListingPurchase(
        id,
        buyerId,
      );

    return {
      success: transaction.state === TransactionState.COMPLETED,
      listingId: id,
      buyer: buyerId,
      transactionId: transaction.id,
      transactionState: transaction.state,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireListings() {
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
