import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NftService } from './nft.service';
import { Nft } from './entities/nft.entity';
import { NftMetadata } from './entities/nft-metadata.entity';
import { SorobanService } from '../../nft/soroban.service';
import { User } from '../../users/user.entity';
import { NftTransferEvent } from '../../jobs/entities/nft-transfer-event.entity';
import { PrometheusService } from '../../common/metrics/prometheus';
import { NftMediaService } from './nft-media.service';
import type { NftQueryResult } from './interfaces/nft.interface';

// Mock PrometheusService
const mockPrometheusService = {
  startRequestTimer: jest.fn().mockReturnValue(jest.fn()),
  observeHttpRequestDuration: jest.fn(),
  incrementHttpRequestsTotal: jest.fn(),
  incrementHttpErrorsTotal: jest.fn(),
  incrementNftMint: jest.fn(),
  incrementListingCreated: jest.fn(),
  incrementSaleCompleted: jest.fn(),
  incrementAuctionBid: jest.fn(),
  incrementTransactionSettled: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue(''),
  getRegistry: jest.fn().mockReturnValue({}),
};

const mockNftRepo = {
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((dto: Partial<Nft>) => dto),
  save: jest
    .fn()
    .mockImplementation((dto: Partial<Nft>) =>
      Promise.resolve({ id: 'nft-1', ...dto }),
    ),
  delete: jest.fn(),
  exists: jest.fn(),
};

const mockMetadataRepo = {
  create: jest.fn((dto: Partial<NftMetadata>) => dto),
  save: jest
    .fn()
    .mockImplementation((dto: Partial<NftMetadata>[]) => Promise.resolve(dto)),
  delete: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
};

const mockUserRepo = {
  exists: jest.fn(),
  findOne: jest.fn(),
};

const mockTransferEventRepo = {
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
  })),
  findOne: jest.fn(),
  create: jest.fn((dto: Partial<NftTransferEvent>) => dto),
  save: jest
    .fn()
    .mockImplementation((dto: Partial<NftTransferEvent>) =>
      Promise.resolve({ id: 'event-1', ...dto }),
    ),
  delete: jest.fn(),
};

const mockSorobanService = {
  getLatestLedger: jest.fn().mockResolvedValue(100),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockNftMediaService = {
  enrichQueryResult: jest.fn(
    (result: NftQueryResult<Nft>): NftQueryResult<Nft> => result,
  ),
  enrichNft: jest.fn((nft: Nft): Nft => nft),
  pregenerateVariants: jest.fn(),
};

describe('NftService', () => {
  let service: NftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NftService,
        { provide: getRepositoryToken(Nft), useValue: mockNftRepo },
        {
          provide: getRepositoryToken(NftMetadata),
          useValue: mockMetadataRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(NftTransferEvent),
          useValue: mockTransferEventRepo,
        },
        { provide: SorobanService, useValue: mockSorobanService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: PrometheusService, useValue: mockPrometheusService },
        { provide: NftMediaService, useValue: mockNftMediaService },
      ],
    }).compile();

    service = module.get<NftService>(NftService);
    jest.clearAllMocks();
    mockSorobanService.getLatestLedger.mockResolvedValue(100);
  });

  it('lists NFTs with pagination', async () => {
    const result = await service.findAll({ page: 1, limit: 10 });
    expect(result.total).toBe(0);
    expect(mockNftRepo.createQueryBuilder).toHaveBeenCalled();
  });

  it('mints NFT when caller is owner', async () => {
    mockNftRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'nft-1',
      ownerId: '11111111-1111-1111-1111-111111111111',
      attributes: [],
    });
    mockUserRepo.exists.mockResolvedValue(true);

    const result = await service.mint(
      {
        tokenId: 'token-1',
        contractAddress: 'C'.repeat(56),
        name: 'Alpha',
        ownerId: '11111111-1111-1111-1111-111111111111',
        creatorId: '11111111-1111-1111-1111-111111111111',
        attributes: [{ traitType: 'Rarity', value: 'Rare' }],
      },
      '11111111-1111-1111-1111-111111111111',
    );

    expect(result.id).toBe('nft-1');
    expect(mockMetadataRepo.save).toHaveBeenCalled();
    expect(mockSorobanService.getLatestLedger).toHaveBeenCalled();
    expect(mockPrometheusService.incrementNftMint).toHaveBeenCalled();
    expect(mockNftMediaService.pregenerateVariants).toHaveBeenCalled();
  });

  it('rejects mint when caller is not owner or creator', async () => {
    await expect(
      service.mint(
        {
          tokenId: 'token-2',
          contractAddress: 'C'.repeat(56),
          name: 'Beta',
          ownerId: '11111111-1111-1111-1111-111111111111',
          creatorId: '22222222-2222-2222-2222-222222222222',
        },
        '33333333-3333-3333-3333-333333333333',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects mint when token already exists', async () => {
    mockNftRepo.findOne.mockResolvedValueOnce({ id: 'existing-nft' });

    await expect(
      service.mint(
        {
          tokenId: 'token-1',
          contractAddress: 'C'.repeat(56),
          name: 'Gamma',
          ownerId: '11111111-1111-1111-1111-111111111111',
          creatorId: '11111111-1111-1111-1111-111111111111',
        },
        '11111111-1111-1111-1111-111111111111',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates metadata only for owner', async () => {
    mockNftRepo.findOne.mockResolvedValue({
      id: 'nft-1',
      ownerId: '11111111-1111-1111-1111-111111111111',
      isBurned: false,
      attributes: [],
    });

    await service.update(
      'nft-1',
      {
        name: 'Updated Name',
        attributes: [{ traitType: 'Mood', value: 'Happy' }],
      },
      '11111111-1111-1111-1111-111111111111',
    );

    expect(mockMetadataRepo.delete).toHaveBeenCalledWith({ nftId: 'nft-1' });
    expect(mockNftRepo.save).toHaveBeenCalled();
  });

  it('forbids update by non-owner', async () => {
    mockNftRepo.findOne.mockResolvedValue({
      id: 'nft-1',
      ownerId: '11111111-1111-1111-1111-111111111111',
      isBurned: false,
      attributes: [],
    });

    await expect(
      service.update(
        'nft-1',
        { name: 'Nope' },
        '22222222-2222-2222-2222-222222222222',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('burns NFT only for owner', async () => {
    mockNftRepo.findOne.mockResolvedValue({
      id: 'nft-1',
      ownerId: '11111111-1111-1111-1111-111111111111',
      isBurned: false,
      attributes: [],
    });

    const result = await service.burn(
      'nft-1',
      '11111111-1111-1111-1111-111111111111',
    );

    expect(result.isBurned).toBe(true);
    expect(mockNftRepo.save).toHaveBeenCalled();
  });

  it('retrieves attributes by nft id', async () => {
    mockNftRepo.findOne.mockResolvedValue({
      id: 'nft-1',
      ownerId: '11111111-1111-1111-1111-111111111111',
      isBurned: false,
      attributes: [],
    });

    await service.getAttributes('nft-1');
    expect(mockMetadataRepo.find).toHaveBeenCalledWith({
      where: { nftId: 'nft-1' },
      order: { createdAt: 'ASC' },
    });
  });
});
