import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsService } from './collections.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Collection } from './entities/collection.entity';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { CreateCollectionDto } from './dto/create-collection.dto';

const mockCollectionRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

const mockUserRepo = () => ({
  findOne: jest.fn(),
});

type MockRepo<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('CollectionsService', () => {
  let service: CollectionsService;
  let collectionRepo: MockRepo<Collection>;
  let userRepo: MockRepo<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: getRepositoryToken(Collection), useFactory: mockCollectionRepo },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
      ],
    }).compile();

    service = module.get(CollectionsService);
    collectionRepo = module.get(getRepositoryToken(Collection));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('createCollection', () => {
    const dto: CreateCollectionDto = {
      name: 'Art',
      description: 'Test description',
      bannerImage: 'test-banner.png',
    };
    
    it('should throw UnauthorizedException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createCollection(dto, '123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should create and save collection', async () => {
      const user = { id: '123' } as User;
      const dto: CreateCollectionDto = {
        name: 'Art',
        description: 'Test description',
        bannerImage: 'test-banner.png',
      };
            const created = { id: 'abc', ...dto, creator: user } as Collection;

      userRepo.findOne.mockResolvedValue(user);
      collectionRepo.create.mockReturnValue(created);
      collectionRepo.save.mockResolvedValue(created);

      const result = await service.createCollection(dto, '123');
      expect(result).toEqual(created);
    });
  });

  describe('getAllCollections', () => {
    it('should return all collections', async () => {
      const collections = [{ id: '1' }, { id: '2' }] as Collection[];
      collectionRepo.find.mockResolvedValue(collections);
      expect(await service.getAllCollections()).toEqual(collections);
    });
  });

  describe('getCollectionById', () => {
    it('should return the collection if found', async () => {
      const collection = { id: '1' } as Collection;
      collectionRepo.findOne.mockResolvedValue(collection);
      expect(await service.getCollectionById('1')).toEqual(collection);
    });

    it('should throw NotFoundException if not found', async () => {
      collectionRepo.findOne.mockResolvedValue(null);
      await expect(service.getCollectionById('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCollection', () => {
    const existing = {
      id: '1',
      name: 'Old',
      creator: { id: 'user1' },
    } as Collection;

    it('should throw if collection not found', async () => {
      collectionRepo.findOne.mockResolvedValue(null);
      await expect(service.updateCollection('1', {}, 'user1')).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not creator', async () => {
      collectionRepo.findOne.mockResolvedValue({ ...existing, creator: { id: 'other' } });
      await expect(service.updateCollection('1', {}, 'user1')).rejects.toThrow(UnauthorizedException);
    });

    it('should update and save collection', async () => {
      collectionRepo.findOne.mockResolvedValue(existing);
      collectionRepo.save.mockResolvedValue({ ...existing, name: 'New' });
      const result = await service.updateCollection('1', { name: 'New' }, 'user1');
      expect(result.name).toBe('New');
    });
  });

  describe('deleteCollection', () => {
    const collection = {
      id: '1',
      creator: { id: 'user1' },
    } as Collection;

    it('should throw if not found', async () => {
      collectionRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteCollection('1', 'user1')).rejects.toThrow(NotFoundException);
    });

    it('should throw if unauthorized', async () => {
      collectionRepo.findOne.mockResolvedValue({ ...collection, creator: { id: 'other' } });
      await expect(service.deleteCollection('1', 'user1')).rejects.toThrow(UnauthorizedException);
    });

    it('should remove collection if authorized', async () => {
      collectionRepo.findOne.mockResolvedValue(collection);
      collectionRepo.remove.mockResolvedValue(undefined);
      await expect(service.deleteCollection('1', 'user1')).resolves.toBeUndefined();
    });
  });

  describe('getCollectionsByUser', () => {
    it('should return user collections', async () => {
      const collections = [{ id: '1' }, { id: '2' }] as Collection[];
      collectionRepo.find.mockResolvedValue(collections);
      expect(await service.getCollectionsByUser('user1')).toEqual(collections);
    });
  });
});
