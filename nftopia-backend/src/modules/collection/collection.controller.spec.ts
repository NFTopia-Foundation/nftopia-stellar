import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionQueryDto } from './dto/collection-query.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

describe('CollectionController', () => {
  let controller: CollectionController;
  let service: jest.Mocked<CollectionService>;

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
    contractAddress: 'C'.repeat(56),
    name: 'Test Collection',
    symbol: 'TEST',
    description: 'Test description',
    imageUrl: 'https://example.com/image.png',
    bannerImageUrl: null,
    creatorId: 'user-123',
    totalSupply: 100,
    floorPrice: '10.5000000',
    totalVolume: '1000.0000000',
    isVerified: false,
    createdAt: new Date('2026-04-20T00:00:00.000Z'),
    updatedAt: new Date('2026-04-20T00:00:00.000Z'),
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
    service = module.get(CollectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('returns a paginated collection connection', async () => {
      const mockResult = {
        data: [mockCollection],
        total: 1,
        hasNextPage: false,
      };
      mockCollectionService.findAll.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20 } as CollectionQueryDto;
      const result = await controller.findAll(query);

      expect(result).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('returns a collection by id', async () => {
      mockCollectionService.findOne.mockResolvedValue(mockCollection);

      const result = await controller.findOne(mockCollection.id);

      expect(result).toEqual(mockCollection);
      expect(service.findOne).toHaveBeenCalledWith(mockCollection.id);
    });

    it('propagates NotFoundException (404) when the service throws', async () => {
      mockCollectionService.findOne.mockRejectedValue(
        new NotFoundException('Collection not found'),
      );

      await expect(controller.findOne(mockCollection.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByContractAddress', () => {
    it('returns a collection by contract address', async () => {
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

    it('propagates NotFoundException (404) when address is unknown', async () => {
      mockCollectionService.findByContractAddress.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        controller.findByContractAddress('C'.repeat(56)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('returns collection statistics', async () => {
      const mockStats = {
        totalVolume: '1000.0000000',
        floorPrice: '10.5000000',
        totalSupply: 100,
        ownerCount: 50,
      };
      mockCollectionService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockCollection.id);

      expect(result).toEqual(mockStats);
      expect(service.getStats).toHaveBeenCalledWith(mockCollection.id);
    });

    it('propagates NotFoundException when stats are requested for a missing collection', async () => {
      mockCollectionService.getStats.mockRejectedValue(new NotFoundException());

      await expect(controller.getStats(mockCollection.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTopCollections', () => {
    it('parses the limit query param and delegates to the service', async () => {
      mockCollectionService.getTopCollections.mockResolvedValue([
        mockCollection,
      ]);

      const result = await controller.getTopCollections('5');

      expect(result).toEqual([mockCollection]);
      expect(service.getTopCollections).toHaveBeenCalledWith(5);
    });

    it('defaults the limit to 10 when none is provided', async () => {
      mockCollectionService.getTopCollections.mockResolvedValue([]);

      await controller.getTopCollections();

      expect(service.getTopCollections).toHaveBeenCalledWith(10);
    });
  });

  describe('getNftsInCollection', () => {
    it('parses page and limit and returns NFTs for a collection', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 2,
        limit: 5,
      };
      mockCollectionService.getNftsInCollection.mockResolvedValue(mockResult);

      const result = await controller.getNftsInCollection(
        mockCollection.id,
        '2',
        '5',
      );

      expect(result).toEqual(mockResult);
      expect(service.getNftsInCollection).toHaveBeenCalledWith(
        mockCollection.id,
        2,
        5,
      );
    });

    it('defaults page=1 and limit=20 when not provided', async () => {
      mockCollectionService.getNftsInCollection.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await controller.getNftsInCollection(mockCollection.id);

      expect(service.getNftsInCollection).toHaveBeenCalledWith(
        mockCollection.id,
        1,
        20,
      );
    });

    it('propagates NotFoundException when the collection is missing', async () => {
      mockCollectionService.getNftsInCollection.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        controller.getNftsInCollection(mockCollection.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto: CreateCollectionDto = {
      contractAddress: 'C'.repeat(56),
      name: 'Test Collection',
      symbol: 'TEST',
      description: 'Test description',
      imageUrl: 'https://example.com/image.png',
    };

    const mockRequest = { user: { userId: 'user-123' } };

    it('creates a new collection using the authenticated user id', async () => {
      mockCollectionService.create.mockResolvedValue(mockCollection);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual(mockCollection);
      expect(service.create).toHaveBeenCalledWith(createDto, 'user-123');
    });

    it('propagates BadRequestException (400) when creation fails validation in the service', async () => {
      mockCollectionService.create.mockRejectedValue(
        new BadRequestException('Collection contract address already exists'),
      );

      await expect(controller.create(createDto, mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('guards the create endpoint with JwtAuthGuard (unauthenticated requests yield 401)', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        CollectionController.prototype.create,
      ) as unknown[];

      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  describe('update', () => {
    const updateDto: UpdateCollectionDto = { name: 'Updated Name' };
    const mockRequest = { user: { userId: 'user-123' } };

    it('updates a collection', async () => {
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

    it('propagates BadRequestException (403-ish) when caller is not the creator', async () => {
      mockCollectionService.update.mockRejectedValue(
        new BadRequestException('Only the creator can update this collection'),
      );

      await expect(
        controller.update(mockCollection.id, updateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException when collection does not exist', async () => {
      mockCollectionService.update.mockRejectedValue(new NotFoundException());

      await expect(
        controller.update(mockCollection.id, updateDto, mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('guards the update endpoint with JwtAuthGuard (unauthenticated requests yield 401)', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        CollectionController.prototype.update,
      ) as unknown[];

      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  describe('DTO validation', () => {
    it('accepts a fully-valid CreateCollectionDto', async () => {
      const dto = plainToInstance(CreateCollectionDto, {
        contractAddress: 'C'.repeat(56),
        name: 'Genesis',
        symbol: 'GEN',
        description: 'desc',
        imageUrl: 'https://example.com/image.png',
      });

      await expect(validate(dto)).resolves.toEqual([]);
    });

    it('rejects a CreateCollectionDto with a malformed contract address', async () => {
      const dto = plainToInstance(CreateCollectionDto, {
        contractAddress: 'not-a-valid-stellar-address',
        name: 'Genesis',
        symbol: 'GEN',
        imageUrl: 'https://example.com/image.png',
      });

      const errors = await validate(dto);
      const contractErr = errors.find((e) => e.property === 'contractAddress');
      expect(contractErr).toBeDefined();
      expect(Object.keys(contractErr!.constraints ?? {})).toEqual(
        expect.arrayContaining(['isLength', 'matches']),
      );
    });

    it('rejects a CreateCollectionDto missing required fields', async () => {
      const dto = plainToInstance(CreateCollectionDto, {});

      const errors = await validate(dto);
      const properties = errors.map((e) => e.property);

      expect(properties).toEqual(
        expect.arrayContaining([
          'contractAddress',
          'name',
          'symbol',
          'imageUrl',
        ]),
      );
    });

    it('rejects a CreateCollectionDto with a non-URL imageUrl', async () => {
      const dto = plainToInstance(CreateCollectionDto, {
        contractAddress: 'C'.repeat(56),
        name: 'Genesis',
        symbol: 'GEN',
        imageUrl: 'not a url',
      });

      const errors = await validate(dto);
      const urlErr = errors.find((e) => e.property === 'imageUrl');
      expect(urlErr?.constraints).toHaveProperty('isUrl');
    });

    it('accepts an empty UpdateCollectionDto (all fields optional)', async () => {
      const dto = plainToInstance(UpdateCollectionDto, {});
      await expect(validate(dto)).resolves.toEqual([]);
    });

    it('rejects UpdateCollectionDto with a name longer than 255 chars', async () => {
      const dto = plainToInstance(UpdateCollectionDto, {
        name: 'x'.repeat(256),
      });
      const errors = await validate(dto);
      const nameErr = errors.find((e) => e.property === 'name');
      expect(nameErr?.constraints).toHaveProperty('isLength');
    });

    it('coerces query params into numbers on CollectionQueryDto', async () => {
      const dto = plainToInstance(CollectionQueryDto, {
        page: '2',
        limit: '50',
      });
      await expect(validate(dto)).resolves.toEqual([]);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(50);
    });

    it('rejects CollectionQueryDto with limit above the max', async () => {
      const dto = plainToInstance(CollectionQueryDto, { limit: 500 });
      const errors = await validate(dto);
      const limitErr = errors.find((e) => e.property === 'limit');
      expect(limitErr?.constraints).toHaveProperty('max');
    });

    it('rejects CollectionQueryDto with an invalid sortBy', async () => {
      const dto = plainToInstance(CollectionQueryDto, { sortBy: 'bogus' });
      const errors = await validate(dto);
      const sortErr = errors.find((e) => e.property === 'sortBy');
      expect(sortErr?.constraints).toHaveProperty('isEnum');
    });
  });
});
