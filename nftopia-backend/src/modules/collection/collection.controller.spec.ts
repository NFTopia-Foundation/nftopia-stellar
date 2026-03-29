import { Test, TestingModule } from '@nestjs/testing';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';

describe('CollectionController', () => {
  let controller: CollectionController;
  let service: CollectionService;

  const mockCollectionService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByContractAddress: jest.fn(),
    update: jest.fn(),
    getStats: jest.fn(),
    getTopCollections: jest.fn(),
    getNftsInCollection: jest.fn(),
  };

  const mockCollection = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    contractAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNOPQR',
    name: 'Test Collection',
    symbol: 'TEST',
    description: 'Test description',
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
      controllers: [CollectionController],
      providers: [
        {
          provide: CollectionService,
          useValue: mockCollectionService,
        },
      ],
    }).compile();

    controller = module.get<CollectionController>(CollectionController);
    service = module.get<CollectionService>(CollectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated collections', async () => {
      const mockResult = {
        data: [mockCollection],
        total: 1,
        page: 1,
        limit: 20,
      } as const;

      mockCollectionService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  describe('findOne', () => {
    it('should return a collection by id', async () => {
      mockCollectionService.findOne.mockResolvedValue(mockCollection);

      const result = await controller.findOne(mockCollection.id);

      expect(result).toEqual(mockCollection);
      expect(service.findOne).toHaveBeenCalledWith(mockCollection.id);
    });
  });

  describe('findByContractAddress', () => {
    it('should return a collection by contract address', async () => {
      mockCollectionService.findByContractAddress.mockResolvedValue(
        mockCollection,
      );

      const result = await controller.findByContractAddress(
        mockCollection.contractAddress,
      );

      expect(result).toEqual(mockCollection);
      expect(service.findByContractAddress).toHaveBeenCalledWith(
        mockCollection.contractAddress,
      );
    });
  });

  describe('getStats', () => {
    it('should return collection statistics', async () => {
      const mockStats = {
        totalSupply: 100,
        floorPrice: '10.5',
        totalVolume: '1000.0',
        owners: 50,
        listedCount: 20,
      };

      mockCollectionService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockCollection.id);

      expect(result).toEqual(mockStats);
      expect(service.getStats).toHaveBeenCalledWith(mockCollection.id);
    });
  });

  describe('getTopCollections', () => {
    it('should return top collections', async () => {
      const mockCollections = [mockCollection];
      mockCollectionService.getTopCollections.mockResolvedValue(
        mockCollections,
      );

      const result = await controller.getTopCollections('10');

      expect(result).toEqual(mockCollections);
      expect(service.getTopCollections).toHaveBeenCalledWith(10);
    });
  });

  describe('getNftsInCollection', () => {
    it('should return NFTs in collection', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      };

      mockCollectionService.getNftsInCollection.mockResolvedValue(mockResult);

      const result = await controller.getNftsInCollection(
        mockCollection.id,
        '1',
        '20',
      );

      expect(result).toEqual(mockResult);
      expect(service.getNftsInCollection).toHaveBeenCalledWith(
        mockCollection.id,
        1,
        20,
      );
    });
  });

  describe('create', () => {
    it('should create a new collection', async () => {
      const createDto = {
        contractAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNOPQR',
        name: 'Test Collection',
        symbol: 'TEST',
        description: 'Test description',
        imageUrl: 'https://example.com/image.png',
      };

      const mockRequest = { user: { userId: 'user-123' } };

      mockCollectionService.create.mockResolvedValue(mockCollection);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual(mockCollection);
      expect(service.create).toHaveBeenCalledWith(createDto, 'user-123');
    });
  });

  describe('update', () => {
    it('should update a collection', async () => {
      const updateDto = { name: 'Updated Name' };
      const mockRequest = { user: { userId: 'user-123' } };
      const updatedCollection = { ...mockCollection, ...updateDto };

      mockCollectionService.update.mockResolvedValue(updatedCollection);

      const result = await controller.update(
        mockCollection.id,
        updateDto,
        mockRequest,
      );

      expect(result).toEqual(updatedCollection);
      expect(service.update).toHaveBeenCalledWith(
        mockCollection.id,
        updateDto,
        'user-123',
      );
    });
  });
});
