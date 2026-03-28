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

  it('finds a collection by id', async () => {
    const collection = makeCollection();
    mockCollectionRepository.findOne.mockResolvedValue(collection);

    await expect(service.findById('collection-1')).resolves.toEqual(collection);
    expect(mockCollectionRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'collection-1' },
    });
  });

  it('throws when a collection is missing', async () => {
    mockCollectionRepository.findOne.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('builds a paginated collection connection result', async () => {
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
  });

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
  });
});
