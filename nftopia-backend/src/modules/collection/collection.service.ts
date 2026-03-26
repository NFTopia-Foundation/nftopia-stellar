import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Collection } from './entities/collection.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionQueryDto } from './dto/collection-query.dto';
import { ICollectionStats } from './interfaces/collection.interface';
import { Nft } from '../nft/entities/nft.entity';

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Nft)
    private readonly nftRepository: Repository<Nft>,
  ) {}

  async create(
    createCollectionDto: CreateCollectionDto,
    userId: string,
  ): Promise<Collection> {
    const contractAddress =
      createCollectionDto.contractAddress ||
      this.generateContractAddress();

    const existingCollection = await this.collectionRepository.findOne({
      where: { contractAddress },
    });

    if (existingCollection) {
      throw new ConflictException(
        'Collection with this contract address already exists',
      );
    }

    const collection = this.collectionRepository.create({
      ...createCollectionDto,
      contractAddress,
      creatorId: userId,
      totalSupply: 0,
      totalVolume: '0',
      isVerified: false,
    });

    return await this.collectionRepository.save(collection);
  }

  async findAll(query: CollectionQueryDto): Promise<{
    data: Collection[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, search, creatorId, isVerified, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.creator', 'creator');

    if (search) {
      queryBuilder.where(
        '(collection.name ILIKE :search OR collection.symbol ILIKE :search OR collection.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (creatorId) {
      queryBuilder.andWhere('collection.creatorId = :creatorId', {
        creatorId,
      });
    }

    if (isVerified !== undefined) {
      queryBuilder.andWhere('collection.isVerified = :isVerified', {
        isVerified,
      });
    }

    queryBuilder
      .orderBy(`collection.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    return collection;
  }

  async findByContractAddress(contractAddress: string): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { contractAddress },
      relations: ['creator'],
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection with contract address ${contractAddress} not found`,
      );
    }

    return collection;
  }

  async update(
    id: string,
    updateCollectionDto: UpdateCollectionDto,
    userId: string,
  ): Promise<Collection> {
    const collection = await this.findOne(id);

    if (collection.creatorId !== userId) {
      throw new ForbiddenException(
        'Only the creator can update this collection',
      );
    }

    Object.assign(collection, updateCollectionDto);
    return await this.collectionRepository.save(collection);
  }

  async getStats(id: string): Promise<ICollectionStats> {
    const collection = await this.findOne(id);

    const nfts = await this.nftRepository.find({
      where: { collectionId: id },
    });

    const uniqueOwners = new Set(nfts.map((nft) => nft.ownerId)).size;

    const listedNfts = nfts.filter((nft) => nft.lastPrice !== null);

    const floorPrice = listedNfts.length > 0
      ? listedNfts
          .map((nft) => parseFloat(nft.lastPrice || '0'))
          .filter((price) => price > 0)
          .sort((a, b) => a - b)[0]?.toString()
      : undefined;

    return {
      totalSupply: collection.totalSupply,
      floorPrice: floorPrice || collection.floorPrice,
      totalVolume: collection.totalVolume,
      owners: uniqueOwners,
      listedCount: listedNfts.length,
    };
  }

  async getTopCollections(limit: number = 10): Promise<Collection[]> {
    return await this.collectionRepository.find({
      relations: ['creator'],
      order: { totalVolume: 'DESC' },
      take: limit,
    });
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
    await this.findOne(id);

    const skip = (page - 1) * limit;

    const [data, total] = await this.nftRepository.findAndCount({
      where: { collectionId: id },
      relations: ['owner', 'creator'],
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

  private generateContractAddress(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let address = 'G';
    for (let i = 0; i < 55; i++) {
      address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
  }
}
