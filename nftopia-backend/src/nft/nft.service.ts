import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { NftFilterDto } from './dto/nft-filter.dto';
import { StellarNft } from './entities/stellar-nft.entity';
import { NftMetadata } from './entities/nft-metadata.entity';
import { SorobanService } from './soroban.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NftService implements OnModuleInit {
  private readonly logger = new Logger(NftService.name);
  private lastSyncedLedger = 0;
  private eventContractIds: string[] = [];

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    @InjectRepository(StellarNft)
    private readonly nftRepository: Repository<StellarNft>,
    @InjectRepository(NftMetadata)
    private readonly metadataRepository: Repository<NftMetadata>,
    private readonly sorobanService: SorobanService,
  ) {}

  async onModuleInit() {
    this.eventContractIds = this.loadEventContractIds();

    if (this.eventContractIds.length === 0) {
      this.logger.warn(
        'NFT sync contract IDs are not configured. Set SOROBAN_EVENT_CONTRACT_IDS to enable event polling.',
      );
    }

    // Initialize lastSyncedLedger from latest ledger or DB
    const latest = await this.sorobanService.getLatestLedger();
    this.lastSyncedLedger = latest > 1000 ? latest - 1000 : 0;
    this.logger.log(`Initialized sync from ledger ${this.lastSyncedLedger}`);
  }

  async findAll(query: NftFilterDto) {
    const qb = this.nftRepository.createQueryBuilder('nft');
    qb.leftJoinAndSelect('nft.metadata', 'metadata');

    if (query.contractId) {
      qb.andWhere('nft.contractId = :contractId', {
        contractId: query.contractId,
      });
    }
    if (query.owner) {
      qb.andWhere('nft.owner = :owner', { owner: query.owner });
    }

    if (query.sortBy === 'price') {
      qb.orderBy('nft.price', query.sortOrder === 'asc' ? 'ASC' : 'DESC');
    } else if (query.sortBy === 'views') {
      qb.orderBy('nft.views', query.sortOrder === 'asc' ? 'ASC' : 'DESC');
    } else {
      qb.orderBy('nft.mintedAt', query.sortOrder === 'asc' ? 'ASC' : 'DESC');
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getMany();
  }

  async findOne(contractId: string, tokenId: string) {
    return this.nftRepository.findOne({
      where: { contractId, tokenId },
      relations: ['metadata'],
    });
  }

  async getPopular() {
    const cacheKey = 'nft:popular';
    const cached = await this.cacheManager.get<StellarNft[]>(cacheKey);
    if (cached) return cached;

    const popular = await this.nftRepository.find({
      order: { views: 'DESC' },
      take: 10,
      relations: ['metadata'],
    });

    await this.cacheManager.set(cacheKey, popular, 300000); // 5 minutes
    return popular;
  }

  async getTopSellers(): Promise<
    Array<{ owner: string; sales: string; volume: string }>
  > {
    const cacheKey = 'nft:top-sellers';
    const cached =
      await this.cacheManager.get<
        Array<{ owner: string; sales: string; volume: string }>
      >(cacheKey);
    if (cached) return cached;

    const sellers: Array<{ owner: string; sales: string; volume: string }> =
      await this.nftRepository.query(`
        SELECT owner, count(*) as sales, sum(volume) as volume
        FROM stellar_nfts
        GROUP BY owner
        ORDER BY volume DESC
        LIMIT 10
    `);

    await this.cacheManager.set(cacheKey, sellers, 300000); // 5 minutes

    return sellers;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.debug('Syncing NFT data...');
    try {
      if (this.eventContractIds.length === 0) {
        this.logger.debug(
          'Skipping NFT sync: no valid SOROBAN_EVENT_CONTRACT_IDS configured.',
        );
        return;
      }

      const latest = await this.sorobanService.getLatestLedger();
      if (latest <= this.lastSyncedLedger) return;

      // Fetch events from lastSyncedLedger to latest
      const events = await this.sorobanService.getEvents(
        this.lastSyncedLedger,
        this.eventContractIds,
      );

      // Process events to find minted/transferred tokens
      // This is a simplification.
      // Ideally we parse: 'mint', 'transfer', 'sale'.
      if (events && events.length > 0) {
        this.logger.debug(`Found ${events.length} new events to process.`);
      }

      this.lastSyncedLedger = latest;
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Sync failed: ${error.message}`);
    }
  }

  private loadEventContractIds(): string[] {
    const configured =
      this.configService.get<string>('SOROBAN_EVENT_CONTRACT_IDS') || '';

    const ids = configured
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const validIds = ids.filter((id) => /^C[A-Z0-9]{55}$/.test(id));
    const invalidCount = ids.length - validIds.length;

    if (invalidCount > 0) {
      this.logger.warn(
        `${invalidCount} invalid contract ID(s) ignored from SOROBAN_EVENT_CONTRACT_IDS.`,
      );
    }

    return validIds;
  }
}
