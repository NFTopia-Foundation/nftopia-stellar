import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../users/user.entity';
import { Nft } from '../nft/entities/nft.entity';
import { CollectionService } from './collection.service';
import { Collection } from './entities/collection.entity';

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'collection-1',
    contractAddress: 'C'.repeat(56),
    name: 'NFTopia Genesis',
    symbol: 'NFTG',
    description: 'Genesis drop',
    imageUrl: 'https://example.com/collection.png',
    bannerImageUrl: null,
    creatorId: 'creator-1',
    creator: {} as User,
    totalSupply: 12,
    floorPrice: '1.2500000',
    totalVolume: '25.5000000',
    isVerified: false,
    createdAt: new Date('2026-03-24T10:00:00.000Z'),
    updatedAt: new Date('2026-03-24T10:00:00.000Z'),
    ...overrides,
  } as Collection;
}

describe('CollectionService', () => {
  let service: CollectionService;

  const queryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  const mockCollectionRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const mockNftRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    findAndCount: jest.fn(),
  };

  const mockUserRepository = {
    exists: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get(CollectionService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById / findOne', () => {
    it('finds a collection by id', async () => {
      const collection = makeCollection();
      mockCollectionRepository.findOne.mockResolvedValue(collection);

      await expect(service.findById('collection-1')).resolves.toEqual(
        collection,
      );
      expect(mockCollectionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'collection-1' },
      });
    });

    it('throws NotFoundException when a collection is missing', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('findOne delegates to findById and returns the collection', async () => {
      const collection = makeCollection();
      mockCollectionRepository.findOne.mockResolvedValue(collection);

      await expect(service.findOne('collection-1')).resolves.toEqual(
        collection,
      );
    });

    it('findOne propagates NotFoundException from findById', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByContractAddress', () => {
    it('returns the collection matching the contract address', async () => {
      const collection = makeCollection();
      mockCollectionRepository.findOne.mockResolvedValue(collection);

      await expect(
        service.findByContractAddress('C'.repeat(56)),
      ).resolves.toEqual(collection);
      expect(mockCollectionRepository.findOne).toHaveBeenCalledWith({
        where: { contractAddress: 'C'.repeat(56) },
      });
    });

    it('throws NotFoundException when no collection has that address', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByContractAddress('C'.repeat(56)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll / findConnection', () => {
    it('findAll delegates to findConnection', async () => {
      queryBuilder.getCount.mockResolvedValue(0);
      queryBuilder.getMany.mockResolvedValue([]);

      const result = await service.findAll({ first: 5 });

      expect(result).toEqual({ data: [], total: 0, hasNextPage: false });
    });

    it('builds a paginated collection connection result with hasNextPage=true', async () => {
      const rows = [makeCollection(), makeCollection({ id: 'collection-2' })];
      queryBuilder.getCount.mockResolvedValue(12);
      queryBuilder.getMany.mockResolvedValue(rows);

      const result = await service.findConnection({
        first: 1,
        search: 'genesis',
        verifiedOnly: true,
      });

      expect(result.total).toBe(12);
      expect(result.data).toHaveLength(1);
      expect(result.hasNextPage).toBe(true);
      expect(mockCollectionRepository.createQueryBuilder).toHaveBeenCalledWith(
        'collection',
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'collection.isVerified = true',
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(collection.name)'),
        { search: '%genesis%' },
      );
    });

    it('uses the default first=20 page size when not provided', async () => {
      queryBuilder.getCount.mockResolvedValue(0);
      queryBuilder.getMany.mockResolvedValue([]);

      const result = await service.findConnection({});

      expect(result.hasNextPage).toBe(false);
      expect(queryBuilder.take).toHaveBeenCalledWith(21);
    });

    it('filters by creatorId and applies cursor after clause', async () => {
      queryBuilder.getCount.mockResolvedValue(3);
      queryBuilder.getMany.mockResolvedValue([makeCollection()]);

      await service.findConnection({
        first: 2,
        creatorId: 'creator-1',
        after: {
          createdAt: '2026-03-24T00:00:00.000Z',
          id: 'collection-0',
        },
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'collection.creatorId = :creatorId',
        { creatorId: 'creator-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('collection.createdAt < :cursorCreatedAt'),
        expect.objectContaining({
          cursorCreatedAt: new Date('2026-03-24T00:00:00.000Z'),
          cursorId: 'collection-0',
        }),
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'collection.createdAt',
        'DESC',
      );
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
        'collection.id',
        'DESC',
      );
    });
  });

  describe('getTopCollections / findTopCollections', () => {
    it('returns top collections ordered by volume', async () => {
      const rows = [makeCollection()];
      mockCollectionRepository.find.mockResolvedValue(rows);

      await expect(service.findTopCollections(5)).resolves.toEqual(rows);
      expect(mockCollectionRepository.find).toHaveBeenCalledWith({
        order: {
          totalVolume: 'DESC',
          createdAt: 'DESC',
        },
        take: 5,
      });
    });

    it('defaults the limit to 10', async () => {
      mockCollectionRepository.find.mockResolvedValue([]);

      await service.findTopCollections();

      expect(mockCollectionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('getTopCollections delegates to findTopCollections with a custom limit', async () => {
      mockCollectionRepository.find.mockResolvedValue([]);

      await service.getTopCollections(3);

      expect(mockCollectionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
    });
  });

  describe('getNftsInCollection', () => {
    it('returns paginated NFTs for an existing collection', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(makeCollection());
      mockNftRepository.findAndCount.mockResolvedValue([
        [{ id: 'nft-1' } as Nft, { id: 'nft-2' } as Nft],
        2,
      ]);

      const result = await service.getNftsInCollection('collection-1', 2, 10);

      expect(result).toEqual({
        data: [{ id: 'nft-1' }, { id: 'nft-2' }],
        total: 2,
        page: 2,
        limit: 10,
      });
      expect(mockNftRepository.findAndCount).toHaveBeenCalledWith({
        where: { collectionId: 'collection-1', isBurned: false },
        skip: 10,
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });

    it('uses default page=1 and limit=20 when omitted', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(makeCollection());
      mockNftRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getNftsInCollection('collection-1');

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
      expect(mockNftRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('throws NotFoundException when the collection is missing', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(null);

      await expect(service.getNftsInCollection('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockNftRepository.findAndCount).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a collection when the caller is the creator', async () => {
      const collection = makeCollection();
      const updated = { ...collection, name: 'Renamed' };
      mockCollectionRepository.findOne.mockResolvedValue(collection);
      mockCollectionRepository.save.mockResolvedValue(updated);

      const result = await service.update(
        'collection-1',
        { name: 'Renamed' },
        'creator-1',
      );

      expect(result).toEqual(updated);
      expect(mockCollectionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'collection-1', name: 'Renamed' }),
      );
    });

    it('rejects update when the caller is not the creator', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(makeCollection());

      await expect(
        service.update('collection-1', { name: 'Hijack' }, 'someone-else'),
      ).rejects.toThrow(BadRequestException);
      expect(mockCollectionRepository.save).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when collection does not exist', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'Hijack' }, 'creator-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('computes collection stats from nft aggregates', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(makeCollection());
      queryBuilder.getRawOne.mockResolvedValue({
        nftCount: '9',
        ownerCount: '4',
        floorPrice: '1.7500000',
      });

      const result = await service.getStats('collection-1');

      expect(result).toEqual({
        totalVolume: '25.5000000',
        floorPrice: '1.7500000',
        totalSupply: 9,
        ownerCount: 4,
      });
    });

    it('falls back to entity values when aggregates are empty', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(
        makeCollection({ totalSupply: 7, floorPrice: null, totalVolume: '0' }),
      );
      queryBuilder.getRawOne.mockResolvedValue(null);

      const result = await service.getStats('collection-1');

      expect(result).toEqual({
        totalVolume: '0.0000000',
        floorPrice: '0.0000000',
        totalSupply: 7,
        ownerCount: 0,
      });
    });

    it('normalizes non-numeric floor price to 0.0000000', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(
        makeCollection({ totalVolume: 'not-a-number' }),
      );
      queryBuilder.getRawOne.mockResolvedValue({
        nftCount: '3',
        ownerCount: '2',
        floorPrice: 'not-a-number',
      });

      const result = await service.getStats('collection-1');

      expect(result).toEqual({
        totalVolume: '0.0000000',
        floorPrice: '0.0000000',
        totalSupply: 3,
        ownerCount: 2,
      });
    });

    it('throws NotFoundException when collection is missing', async () => {
      mockCollectionRepository.findOne.mockResolvedValue(null);

      await expect(service.getStats('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a collection for a valid creator', async () => {
      const collection = makeCollection({
        totalSupply: 0,
        totalVolume: '0.0000000',
      });
      mockUserRepository.exists.mockResolvedValue(true);
      mockCollectionRepository.findOne.mockResolvedValue(null);
      mockCollectionRepository.create.mockReturnValue(collection);
      mockCollectionRepository.save.mockResolvedValue(collection);

      const result = await service.create(
        {
          contractAddress: 'C'.repeat(56),
          name: 'NFTopia Genesis',
          symbol: 'NFTG',
          description: 'Genesis drop',
          imageUrl: 'https://example.com/collection.png',
        },
        'creator-1',
      );

      expect(result).toEqual(collection);
      expect(mockCollectionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorId: 'creator-1',
          totalSupply: 0,
          totalVolume: '0.0000000',
        }),
      );
    });

    it('prefers dto.creatorId over the authenticated creator when provided', async () => {
      mockUserRepository.exists.mockResolvedValue(true);
      mockCollectionRepository.findOne.mockResolvedValue(null);
      mockCollectionRepository.create.mockImplementation(
        (obj: Partial<Collection>) => obj as Collection,
      );
      mockCollectionRepository.save.mockImplementation(
        (obj: Partial<Collection>) => Promise.resolve(obj as Collection),
      );

      await service.create(
        {
          contractAddress: 'C'.repeat(56),
          name: 'NFTopia Genesis',
          symbol: 'NFTG',
          imageUrl: 'https://example.com/collection.png',
          creatorId: 'override-creator',
        },
        'creator-1',
      );

      expect(mockUserRepository.exists).toHaveBeenCalledWith({
        where: { id: 'override-creator' },
      });
      expect(mockCollectionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ creatorId: 'override-creator' }),
      );
    });

    it('rejects create when creator does not exist', async () => {
      mockUserRepository.exists.mockResolvedValue(false);

      await expect(
        service.create(
          {
            contractAddress: 'C'.repeat(56),
            name: 'NFTopia Genesis',
            symbol: 'NFTG',
            imageUrl: 'https://example.com/collection.png',
          },
          'creator-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockCollectionRepository.save).not.toHaveBeenCalled();
    });

    it('rejects create when contract address already exists', async () => {
      mockUserRepository.exists.mockResolvedValue(true);
      mockCollectionRepository.findOne.mockResolvedValue(makeCollection());

      await expect(
        service.create(
          {
            contractAddress: 'C'.repeat(56),
            name: 'NFTopia Genesis',
            symbol: 'NFTG',
            imageUrl: 'https://example.com/collection.png',
          },
          'creator-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockCollectionRepository.save).not.toHaveBeenCalled();
    });
  });
});
