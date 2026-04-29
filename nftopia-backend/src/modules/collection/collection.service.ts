import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../../users/user.entity';
import { Nft } from '../nft/entities/nft.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { Collection } from './entities/collection.entity';
import { VerificationRequest, VerificationStatus } from './entities/verification-request.entity';
import { SubmitVerificationRequestDto } from './dto/verification-request.dto';
import {
  type CollectionConnectionQuery,
  type CollectionConnectionResult,
  type CollectionStatsResult,
} from './interfaces/collection.interface';

type RawCollectionAggregates = {
  ownerCount: string | null;
  nftCount: string | null;
  floorPrice: string | null;
};

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Nft)
    private readonly nftRepository: Repository<Nft>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(VerificationRequest)
    private readonly verificationRequestRepository: Repository<VerificationRequest>,
  ) {}

  async findById(id: string): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return collection;
  }

  async findOne(id: string): Promise<Collection> {
    return this.findById(id);
  }

  async findAll(
    query: CollectionConnectionQuery,
  ): Promise<CollectionConnectionResult> {
    return this.findConnection(query);
  }

  async findByContractAddress(contractAddress: string): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { contractAddress },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection with contract address ${contractAddress} not found`,
      );
    }

    return collection;
  }

  async getTopCollections(limit: number = 10): Promise<Collection[]> {
    return this.findTopCollections(limit);
  }

  async getNftsInCollection(
    id: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Nft[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.findById(id);

    const skip = (page - 1) * limit;

    const [data, total] = await this.nftRepository.findAndCount({
      where: { collectionId: id, isBurned: false },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async update(
    id: string,
    updateDto: any,
    userId: string,
  ): Promise<Collection> {
    const collection = await this.findById(id);

    if (collection.creatorId !== userId) {
      throw new BadRequestException(
        'Only the creator can update this collection',
      );
    }

    Object.assign(collection, updateDto);
    return await this.collectionRepository.save(collection);
  }

  async findConnection(
    query: CollectionConnectionQuery,
  ): Promise<CollectionConnectionResult> {
    const first = query.first ?? 20;

    const [total, rows] = await Promise.all([
      this.createBaseQuery(query).getCount(),
      this.createConnectionQuery(query, first).getMany(),
    ]);

    return {
      data: rows.slice(0, first),
      total,
      hasNextPage: rows.length > first,
    };
  }

  async findTopCollections(limit = 10): Promise<Collection[]> {
    return this.collectionRepository.find({
      order: {
        totalVolume: 'DESC',
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  async getStats(collectionId: string): Promise<CollectionStatsResult> {
    const collection = await this.findById(collectionId);

    const raw = (await this.nftRepository
      .createQueryBuilder('nft')
      .select('COUNT(*)', 'nftCount')
      .addSelect('COUNT(DISTINCT nft.ownerId)', 'ownerCount')
      .addSelect('MIN(nft.lastPrice)', 'floorPrice')
      .where('nft.collectionId = :collectionId', { collectionId })
      .andWhere('nft.isBurned = false')
      .getRawOne()) as RawCollectionAggregates | null;

    const totalSupply = raw?.nftCount
      ? Number(raw.nftCount)
      : collection.totalSupply;
    const ownerCount = raw?.ownerCount ? Number(raw.ownerCount) : 0;

    return {
      totalVolume: this.toDecimalString(collection.totalVolume),
      floorPrice: this.toDecimalString(
        raw?.floorPrice ?? collection.floorPrice,
      ),
      totalSupply,
      ownerCount,
    };
  }

  async create(
    dto: CreateCollectionDto,
    creatorId: string,
  ): Promise<Collection> {
    const ownerId = dto.creatorId ?? creatorId;

    const creatorExists = await this.userRepository.exists({
      where: { id: ownerId },
    });

    if (!creatorExists) {
      throw new BadRequestException('creatorId does not exist');
    }

    const existing = await this.collectionRepository.findOne({
      where: { contractAddress: dto.contractAddress },
    });

    if (existing) {
      throw new BadRequestException(
        'Collection contract address already exists',
      );
    }

    const collection = this.collectionRepository.create({
      contractAddress: dto.contractAddress,
      name: dto.name,
      symbol: dto.symbol,
      description: dto.description,
      imageUrl: dto.imageUrl,
      bannerImageUrl: dto.bannerImageUrl,
      creatorId: ownerId,
      totalSupply: 0,
      floorPrice: null,
      totalVolume: '0.0000000',
      isVerified: false,
    });

    return this.collectionRepository.save(collection);
  }

  private createBaseQuery(
    query: Pick<
      CollectionConnectionQuery,
      'creatorId' | 'search' | 'verifiedOnly'
    >,
  ): SelectQueryBuilder<Collection> {
    const qb = this.collectionRepository.createQueryBuilder('collection');

    if (query.creatorId) {
      qb.andWhere('collection.creatorId = :creatorId', {
        creatorId: query.creatorId,
      });
    }

    if (query.verifiedOnly) {
      qb.andWhere('collection.isVerified = true');
    }

    if (query.search) {
      qb.andWhere(
        "(LOWER(collection.name) LIKE :search OR LOWER(collection.symbol) LIKE :search OR LOWER(COALESCE(collection.description, '')) LIKE :search)",
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    return qb;
  }

  private createConnectionQuery(
    query: CollectionConnectionQuery,
    first: number,
  ): SelectQueryBuilder<Collection> {
    const qb = this.createBaseQuery(query);

    if (query.after) {
      qb.andWhere(
        '(collection.createdAt < :cursorCreatedAt OR (collection.createdAt = :cursorCreatedAt AND collection.id < :cursorId))',
        {
          cursorCreatedAt: new Date(query.after.createdAt),
          cursorId: query.after.id,
        },
      );
    }

    return qb
      .orderBy('collection.createdAt', 'DESC')
      .addOrderBy('collection.id', 'DESC')
      .take(first + 1);
  }

  private toDecimalString(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '0.0000000';
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return '0.0000000';
    }

    return parsed.toFixed(7);
  }

  async submitVerificationRequest(
    collectionId: string,
    requesterId: string,
    dto: SubmitVerificationRequestDto,
  ): Promise<VerificationRequest> {
    // Check if collection exists
    const collection = await this.findById(collectionId);

    // Verify the requester is the collection creator
    if (collection.creatorId !== requesterId) {
      throw new ForbiddenException('Only the collection creator can request verification');
    }

    // Check if there's already a pending request
    const existingRequest = await this.verificationRequestRepository.findOne({
      where: {
        collectionId,
        status: VerificationStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new BadRequestException('A verification request is already pending for this collection');
    }

    // Create new verification request
    const verificationRequest = this.verificationRequestRepository.create({
      collectionId,
      requesterId,
      proofLinks: dto.proofLinks,
      additionalInfo: dto.additionalInfo,
      status: VerificationStatus.PENDING,
    });

    return this.verificationRequestRepository.save(verificationRequest);
  }

  async getPendingVerificationRequests(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: VerificationRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.verificationRequestRepository.findAndCount({
      where: { status: VerificationStatus.PENDING },
      relations: ['collection', 'requester'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async approveVerificationRequest(
    requestId: string,
    adminId: string,
    reviewNotes?: string,
  ): Promise<VerificationRequest> {
    const request = await this.verificationRequestRepository.findOne({
      where: { id: requestId },
      relations: ['collection'],
    });

    if (!request) {
      throw new NotFoundException('Verification request not found');
    }

    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Verification request has already been reviewed');
    }

    // Update request status
    request.status = VerificationStatus.APPROVED;
    request.reviewedBy = adminId;
    request.reviewNotes = reviewNotes;
    request.reviewedAt = new Date();

    // Update collection isVerified to true
    request.collection.isVerified = true;
    await this.collectionRepository.save(request.collection);

    return this.verificationRequestRepository.save(request);
  }

  async rejectVerificationRequest(
    requestId: string,
    adminId: string,
    reviewNotes?: string,
  ): Promise<VerificationRequest> {
    const request = await this.verificationRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Verification request not found');
    }

    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Verification request has already been reviewed');
    }

    request.status = VerificationStatus.REJECTED;
    request.reviewedBy = adminId;
    request.reviewNotes = reviewNotes;
    request.reviewedAt = new Date();

    return this.verificationRequestRepository.save(request);
  }
}
