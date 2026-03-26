import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from './entities/listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingStatus } from './interfaces/listing.interface';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(StellarNft)
    private readonly nftRepo: Repository<StellarNft>,
  ) {}

  async create(dto: CreateListingDto, sellerId: string) {
    if (dto.price <= 0) throw new BadRequestException('Price must be positive');

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

    // Transfer ownership in DB
    const nft = await this.nftRepo.findOne({
      where: { contractId: listing.nftContractId, tokenId: listing.nftTokenId },
    });
    if (!nft) throw new NotFoundException('NFT not found');
    nft.owner = buyerId;
    await this.nftRepo.save(nft);

    listing.status = ListingStatus.SOLD;
    await this.listingRepo.save(listing);

    // Payment/on-chain transfer not implemented — placeholder for Soroban integration
    return { success: true, listingId: id, buyer: buyerId };
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
