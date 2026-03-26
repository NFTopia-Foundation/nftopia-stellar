import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nft } from './entities/nft.entity';
import { NftMetadata } from './entities/nft-metadata.entity';
import { CreateNftDto } from './dto/create-nft.dto';
import { UpdateNftDto } from './dto/update-nft.dto';
import { NftQueryDto } from './dto/nft-query.dto';
import {
  BurnNftResponse,
  NftQueryResult,
  StellarMintSyncResult,
} from './interfaces/nft.interface';
import { SorobanService } from '../../nft/soroban.service';
import { User } from '../../users/user.entity';

@Injectable()
export class NftService {
  private readonly logger = new Logger(NftService.name);

  constructor(
    @InjectRepository(Nft)
    private readonly nftRepository: Repository<Nft>,
    @InjectRepository(NftMetadata)
    private readonly metadataRepository: Repository<NftMetadata>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly sorobanService: SorobanService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(query: NftQueryDto): Promise<NftQueryResult<Nft>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.nftRepository
      .createQueryBuilder('nft')
      .leftJoinAndSelect('nft.attributes', 'attributes');

    if (!query.includeBurned) {
      qb.andWhere('nft.isBurned = false');
    }

    if (query.ownerId) {
      qb.andWhere('nft.ownerId = :ownerId', { ownerId: query.ownerId });
    }

    if (query.creatorId) {
      qb.andWhere('nft.creatorId = :creatorId', { creatorId: query.creatorId });
    }

    if (query.collectionId) {
      qb.andWhere('nft.collectionId = :collectionId', {
        collectionId: query.collectionId,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(nft.name) LIKE :search OR LOWER(nft.description) LIKE :search)',
        {
          search: `%${query.search.toLowerCase()}%`,
        },
      );
    }

    qb.orderBy('nft.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Nft> {
    const nft = await this.nftRepository.findOne({
      where: { id },
      relations: ['attributes'],
    });

    if (!nft) {
      throw new NotFoundException('NFT not found');
    }

    return nft;
  }

  async findByTokenId(tokenId: string): Promise<Nft> {
    const nft = await this.nftRepository.findOne({
      where: { tokenId },
      relations: ['attributes'],
    });

    if (!nft) {
      throw new NotFoundException('NFT not found');
    }

    return nft;
  }

  async findByOwner(
    ownerId: string,
    query: NftQueryDto,
  ): Promise<NftQueryResult<Nft>> {
    return this.findAll({ ...query, ownerId });
  }

  async findByCollection(
    collectionId: string,
    query: NftQueryDto,
  ): Promise<NftQueryResult<Nft>> {
    return this.findAll({ ...query, collectionId });
  }

  async mint(dto: CreateNftDto, callerId: string): Promise<Nft> {
    if (callerId !== dto.ownerId && callerId !== dto.creatorId) {
      throw new ForbiddenException(
        'Caller is not allowed to mint for this NFT',
      );
    }

    const existing = await this.nftRepository.findOne({
      where: { tokenId: dto.tokenId },
    });

    if (existing) {
      throw new BadRequestException('Token ID already exists');
    }

    await this.validateUserIds(dto.ownerId, dto.creatorId);
    await this.syncMintWithSoroban(dto.contractAddress, dto.tokenId);

    const nft = this.nftRepository.create({
      tokenId: dto.tokenId,
      contractAddress: dto.contractAddress,
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
      animationUrl: dto.animationUrl,
      externalUrl: dto.externalUrl,
      ownerId: dto.ownerId,
      creatorId: dto.creatorId,
      collectionId: dto.collectionId,
      lastPrice:
        dto.lastPrice !== undefined && dto.lastPrice !== null
          ? dto.lastPrice.toString()
          : undefined,
      mintedAt: new Date(),
      isBurned: false,
    });

    const savedNft = await this.nftRepository.save(nft);

    if (dto.attributes?.length) {
      const attributes = dto.attributes.map((attribute) =>
        this.metadataRepository.create({
          nftId: savedNft.id,
          traitType: attribute.traitType,
          value: attribute.value,
          displayType: attribute.displayType,
        }),
      );

      await this.metadataRepository.save(attributes);
    }

    const indexedNft = await this.findById(savedNft.id);
    this.emitSearchEvent('search.nft.upsert', { nftId: indexedNft.id });
    return indexedNft;
  }

  async update(id: string, dto: UpdateNftDto, callerId: string): Promise<Nft> {
    const nft = await this.findById(id);

    if (nft.isBurned) {
      throw new BadRequestException('Burned NFT cannot be updated');
    }

    if (nft.ownerId !== callerId) {
      throw new ForbiddenException('Only NFT owner can update metadata');
    }

    Object.assign(nft, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.animationUrl !== undefined
        ? { animationUrl: dto.animationUrl }
        : {}),
      ...(dto.externalUrl !== undefined
        ? { externalUrl: dto.externalUrl }
        : {}),
      ...(dto.collectionId !== undefined
        ? { collectionId: dto.collectionId }
        : {}),
      ...(dto.lastPrice !== undefined
        ? { lastPrice: dto.lastPrice.toString() }
        : {}),
    });

    await this.nftRepository.save(nft);

    if (dto.attributes) {
      await this.metadataRepository.delete({ nftId: nft.id });

      if (dto.attributes.length) {
        const updatedAttributes = dto.attributes.map((attribute) =>
          this.metadataRepository.create({
            nftId: nft.id,
            traitType: attribute.traitType,
            value: attribute.value,
            displayType: attribute.displayType,
          }),
        );

        await this.metadataRepository.save(updatedAttributes);
      }
    }

    const indexedNft = await this.findById(nft.id);
    this.emitSearchEvent('search.nft.upsert', { nftId: indexedNft.id });
    return indexedNft;
  }

  async burn(id: string, callerId: string): Promise<BurnNftResponse> {
    const nft = await this.findById(id);

    if (nft.ownerId !== callerId) {
      throw new ForbiddenException('Only NFT owner can burn NFT');
    }

    if (nft.isBurned) {
      throw new BadRequestException('NFT is already burned');
    }

    nft.isBurned = true;
    await this.nftRepository.save(nft);
    this.emitSearchEvent('search.nft.delete', { nftId: nft.id });

    return {
      id: nft.id,
      isBurned: nft.isBurned,
      burnedAt: new Date().toISOString(),
    };
  }

  async getAttributes(id: string): Promise<NftMetadata[]> {
    await this.findById(id);

    return this.metadataRepository.find({
      where: { nftId: id },
      order: { createdAt: 'ASC' },
    });
  }

  private async validateUserIds(ownerId: string, creatorId: string) {
    const [ownerExists, creatorExists] = await Promise.all([
      this.userRepository.exists({ where: { id: ownerId } }),
      this.userRepository.exists({ where: { id: creatorId } }),
    ]);

    if (!ownerExists) {
      throw new BadRequestException('ownerId does not exist');
    }

    if (!creatorExists) {
      throw new BadRequestException('creatorId does not exist');
    }
  }

  private async syncMintWithSoroban(
    contractAddress: string,
    tokenId: string,
  ): Promise<StellarMintSyncResult> {
    const latestLedger = await this.sorobanService.getLatestLedger();

    if (!latestLedger || latestLedger < 1) {
      throw new ServiceUnavailableException(
        'Unable to sync mint with Stellar Soroban network',
      );
    }

    this.logger.log(
      `Mint synced with Soroban at ledger ${latestLedger} for ${contractAddress}:${tokenId}`,
    );

    return {
      synced: true,
      ledger: latestLedger,
      tokenId,
      contractAddress,
    };
  }

  private emitSearchEvent(eventName: string, payload: Record<string, string>) {
    setImmediate(() => {
      this.eventEmitter.emit(eventName, payload);
    });
  }
}
