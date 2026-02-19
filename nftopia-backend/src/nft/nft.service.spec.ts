import { Test, TestingModule } from '@nestjs/testing';
import { NftService } from './nft.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StellarNft } from './entities/stellar-nft.entity';
import { NftMetadata } from './entities/nft-metadata.entity';
import { SorobanService } from './soroban.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  query: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockReturnValue([]),
  })),
};

const mockSorobanService = {
  getLatestLedger: jest.fn().mockResolvedValue(100),
  getEvents: jest.fn().mockResolvedValue([]),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
};

describe('NftService', () => {
  let service: NftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NftService,
        {
          provide: getRepositoryToken(StellarNft),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(NftMetadata),
          useValue: mockRepository,
        },
        {
          provide: SorobanService,
          useValue: mockSorobanService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<NftService>(NftService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should findAll NFTs', async () => {
    const result = await service.findAll({});
    expect(result).toEqual([]);
    expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
  });

  it('should get popular NFTs (cached)', async () => {
    mockCacheManager.get.mockResolvedValueOnce([{ id: 1 }]);
    const result = await service.getPopular();
    expect(result).toEqual([{ id: 1 }]);
    expect(mockRepository.find).not.toHaveBeenCalled();
  });

  it('should get popular NFTs (database)', async () => {
    mockCacheManager.get.mockResolvedValueOnce(null);
    mockRepository.find.mockResolvedValueOnce([{ id: 2 }]);
    const result = await service.getPopular();
    expect(result).toEqual([{ id: 2 }]);
    expect(mockRepository.find).toHaveBeenCalled();
    expect(mockCacheManager.set).toHaveBeenCalled();
  });
});
