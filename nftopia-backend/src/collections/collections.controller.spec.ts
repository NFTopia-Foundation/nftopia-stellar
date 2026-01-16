import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/create-collection.dto';
import { UnauthorizedException } from '@nestjs/common';

describe('CollectionsController', () => {
  let controller: CollectionsController;
  let service: CollectionsService;

  const mockCollection = {
    id: 'uuid-123',
    name: 'Test Collection',
    description: 'Some description',
    bannerImage: 'image.png',
    creator: { id: 'user-id' },
    createdAt: new Date(),
  };

  const mockService = {
    createCollection: jest.fn(),
    getAllCollections: jest.fn(),
    getCollectionById: jest.fn(),
    updateCollection: jest.fn(),
    deleteCollection: jest.fn(),
    getCollectionsByUser: jest.fn(),
  };

  const mockReq = {
    user: {
      sub: 'user-id',
    },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        { provide: CollectionsService, useValue: mockService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<CollectionsController>(CollectionsController);
    service = module.get<CollectionsService>(CollectionsService);
  });

  it('should create a collection', async () => {
    const dto: CreateCollectionDto = {
      name: 'New Collection',
      description: 'Nice collection',
      bannerImage: 'banner.jpg',
    };

    mockService.createCollection.mockResolvedValue(mockCollection);

    const result = await controller.createCollection(dto, mockReq);
    expect(result).toEqual({
      message: 'Collection created successfully',
      collection: mockCollection,
    });
    expect(service.createCollection).toHaveBeenCalledWith(dto, 'user-id');
  });

  it('should get all collections', async () => {
    mockService.getAllCollections.mockResolvedValue([mockCollection]);
    const result = await controller.getAllCollections();
    expect(result).toEqual({ collections: [mockCollection] });
  });

  it('should get collection by ID', async () => {
    mockService.getCollectionById.mockResolvedValue(mockCollection);
    const result = await controller.getCollectionById('uuid-123');
    expect(result).toEqual({ collection: mockCollection });
  });

  it('should update a collection', async () => {
    const dto: UpdateCollectionDto = {
      name: 'Updated Collection',
      description: 'Updated',
      bannerImage: 'new-banner.jpg',
    };

    const updated = { ...mockCollection, ...dto };
    mockService.updateCollection.mockResolvedValue(updated);

    const result = await controller.updateCollection('uuid-123', dto, mockReq);
    expect(result).toEqual({
      message: 'Collection updated successfully',
      collection: updated,
    });
  });

  it('should delete a collection', async () => {
    mockService.deleteCollection.mockResolvedValue(undefined);
    await expect(
      controller.deleteCollection('uuid-123', mockReq),
    ).resolves.toBeUndefined();
    expect(service.deleteCollection).toHaveBeenCalledWith('uuid-123', 'user-id');
  });

  it('should get collections by user ID', async () => {
    mockService.getCollectionsByUser.mockResolvedValue([mockCollection]);
    const result = await controller.getCollectionsByUser('user-id');
    expect(result).toEqual({ collections: [mockCollection] });
  });
});
