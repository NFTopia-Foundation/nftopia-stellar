import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionService } from './collection.service';
import { Collection } from './entities/collection.entity';
import { Nft } from '../nft/entities/nft.entity';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

describe('CollectionService', () => {
  let service: CollectionService;
  let collectionRepository: Repository<Collection>;
  let nftRepository: Repository<Nft>;

  const mockCollectionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockNftRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockCollection = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    contractAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNOPQR',
    name: 'Test Collection',
    symbol: 'TEST',
    description: 'Test description',
    imageUrl: 'https://example.com/image.png',
    bannerImageUrl: 'https://example.com/banner.png',
    creatorId: 'user-123',
    totalSupply: 100,
    floorPrice: '10.5',
    totalVolume: '1000.0',
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        {
          provide: getRepositoryToken(Collection),
          useValue: mockCollectionRepository,
        },
        {
          provide: getRepositoryToken(Nft),
          useValue: mockNftRepository,
        },
      ],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
    collectionRepository = module.get<Repository<Collection>>(
      getRepositoryToken(Collection),
    );
    nftRepository = module.get<Repository<Nft>>(getRepositoryToken(Nft));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new collection', async () => {
      const createDto = {
        name: 'Test Collection',
        symbol: 'TEST',
        description: 'Test description',
      };

      mockCollectionRepository.findOne.mockResolvedValue(null);
      mockCollectionRepository.create.mockReturnValue(mockCollection);
      mockCollectionRepository.save.mockResolvedValue(mockCollection);

      const result = await service.create(createDto, 'user-123');

      expect(result).toEqual(mockCollection);
      expect(mockCollectionRepository.create).toHaveBeenCalled();
      expect(mockCollectionRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if contract address exists', async () => {
      const createDto = {
        name: 'Test Collection',
        symbol: 'TEST',
        contractAddress: mockCollection.contractAddress,
      };

      mockCollectionRepository.findOne.mockResolvedValue(mockCollection);

      await expect(service.create(createDto, 'user-123')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a collection by id', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(mockCollection);

      const result = await service.findOne(mockCollection.id);

      expect(result).toEqual(mockCollection);
      expect(mockCollectionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockCollection.id },
        relations: ['creator'],
      });
    });

    it('should throw NotFoundException if collection not found', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByContractAddress', () => {
    it('should return a collection by contract address', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(mockCollection);

      const result = await service.findByContractAddress(
        mockCollection.contractAddress,
      );

      expect(result).toEqual(mockCollection);
    });

    it('should throw NotFoundException if collection not found', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByContractAddress('non-existent-address'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a collection', async () => {
      const updateDto = { name: 'Updated Name' };
      const updatedCollection = { ...mockCollection, ...updateDto };

      mockCollectionRepository.findOne.mockResolvedValue(mockCollection);
      mockCollectionRepository.save.mockResolvedValue(updatedCollection);

      const result = await service.update(
        mockCollection.id,
        updateDto,
        'user-123',
      );

      expect(result.name).toEqual('Updated Name');
      expect(mockCollectionRepository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not creator', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(mockCollection);

      await expect(
        service.update(mockCollection.id, { name: 'New Name' }, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getStats', () => {
    it('should return collection statistics', async () => {
      const mockNfts = [
        { ownerId: 'owner1', lastPrice: '10.5' },
        { ownerId: 'owner2', lastPrice: '15.0' },
        { ownerId: 'owner1', lastPrice: '8.0' },
      ];

      mockCollectionRepository.findOne.mockResolvedValue(mockCollection);
      mockNftRepository.find.mockResolvedValue(mockNfts);

      const result = await service.getStats(mockCollection.id);

      expect(result).toHaveProperty('totalSupply');
      expect(result).toHaveProperty('floorPrice');
      expect(result).toHaveProperty('owners');
      expect(result.owners).toBe(2);
    });
  });

  describe('getTopCollections', () => {
    it('should return top collections by volume', async () => {
      const mockCollections = [mockCollection];
      mockCollectionRepository.find.mockResolvedValue(mockCollections);

      const result = await service.getTopCollections(10);

      expect(result).toEqual(mockCollections);
      expect(mockCollectionRepository.find).toHaveBeenCalledWith({
        relations: ['creator'],
        order: { totalVolume: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getNftsInCollection', () => {
    it('should return paginated NFTs in collection', async () => {
      const mockNfts = [
        { id: 'nft1', collectionId: mockCollection.id },
        { id: 'nft2', collectionId: mockCollection.id },
      ];

      mockCollectionRepository.findOne.mockResolvedValue(mockCollection);
      mockNftRepository.findAndCount.mockResolvedValue([mockNfts, 2]);

      const result = await service.getNftsInCollection(mockCollection.id, 1, 20);

      expect(result.data).toEqual(mockNfts);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
