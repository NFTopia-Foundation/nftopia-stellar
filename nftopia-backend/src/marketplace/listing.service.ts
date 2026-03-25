import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Listing, ListingStatus } from './entities/listing.entity';

export interface ListingFilter {
  status?: ListingStatus;
  nftId?: string;
  sellerId?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface ListingConnectionResult {
  items: Listing[];
  totalCount: number;
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface CreateListingParams {
  nftId: string;
  sellerId: string;
  price: string;
  currency?: string;
  expiresAt?: Date | null;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  message: string;
}

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  async findById(id: string): Promise<Listing | null> {
    return this.listingRepository.findOne({ where: { id } });
  }

  async findActiveById(id: string): Promise<Listing | null> {
    return this.listingRepository.findOne({
      where: { id, status: ListingStatus.ACTIVE },
    });
  }

  async findListings(
    filter: ListingFilter = {},
    pagination: PaginationOptions = {},
  ): Promise<ListingConnectionResult> {
    const where: FindOptionsWhere<Listing> = {};

    if (filter.status) where.status = filter.status;
    if (filter.nftId) where.nftId = filter.nftId;
    if (filter.sellerId) where.sellerId = filter.sellerId;

    const limit = Math.max(1, Math.min(100, pagination.limit ?? 20));
    const offset = Math.max(0, pagination.offset ?? 0);

    const [items, totalCount] = await this.listingRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      items,
      totalCount,
      hasNextPage: offset + items.length < totalCount,
      endCursor: items.length ? items[items.length - 1].id : null,
    };
  }

  async createListing(input: CreateListingParams): Promise<Listing> {
    const numericPrice = Number(input.price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      throw new BadRequestException('Price must be greater than zero');
    }

    const listing = this.listingRepository.create({
      nftId: input.nftId,
      sellerId: input.sellerId,
      price: input.price,
      currency: input.currency ?? 'XLM',
      status: ListingStatus.ACTIVE,
      expiresAt: input.expiresAt ?? null,
    });

    return this.listingRepository.save(listing);
  }

  async cancelListing(id: string, requesterId: string): Promise<boolean> {
    const listing = await this.findByIdOrFail(id);

    if (listing.sellerId !== requesterId) {
      throw new BadRequestException('Only listing owner can cancel listing');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Only active listings can be cancelled');
    }

    listing.status = ListingStatus.CANCELLED;
    await this.listingRepository.save(listing);
    return true;
  }

  async buyNft(id: string, buyerId: string): Promise<TransactionResult> {
    const listing = await this.findByIdOrFail(id);

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Listing is not active');
    }

    if (listing.sellerId === buyerId) {
      throw new BadRequestException('Seller cannot buy own listing');
    }

    if (listing.expiresAt && listing.expiresAt.getTime() < Date.now()) {
      listing.status = ListingStatus.EXPIRED;
      await this.listingRepository.save(listing);
      throw new BadRequestException('Listing has expired');
    }

    listing.status = ListingStatus.SOLD;
    await this.listingRepository.save(listing);

    const txHash = `mock_tx_${listing.id}`;
    this.logger.log(`Listing ${listing.id} sold to ${buyerId}, tx=${txHash}`);

    return {
      success: true,
      txHash,
      message: 'Purchase completed',
    };
  }

  private async findByIdOrFail(id: string): Promise<Listing> {
    const listing = await this.findById(id);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }
}
