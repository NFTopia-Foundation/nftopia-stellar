import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: Repository<Category>;

  const mockCategory: Category = {
    id: 1,
    name: 'Art',
    description: 'All about art',
    nfts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    repo = module.get<Repository<Category>>(getRepositoryToken(Category));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a category', async () => {
    const dto: CreateCategoryDto = { name: 'Art', description: 'All about art' };
    mockRepo.create.mockReturnValue(mockCategory);
    mockRepo.save.mockResolvedValue(mockCategory);

    const result = await service.create(dto);
    expect(result).toEqual(mockCategory);
    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(repo.save).toHaveBeenCalledWith(mockCategory);
  });

  it('should update an existing category', async () => {
    const dto: UpdateCategoryDto = { name: 'New Name', description: 'Updated desc' };
    mockRepo.findOne.mockResolvedValue({ ...mockCategory });
    mockRepo.save.mockResolvedValue({ ...mockCategory, ...dto });

    const result = await service.update(1, dto);
    expect(result).toEqual({ ...mockCategory, ...dto });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(repo.save).toHaveBeenCalledWith({ ...mockCategory, ...dto });
  });

  it('should throw if category not found on update', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.update(1, { name: 'Fail', description: 'Fail' })).rejects.toThrow('Category not found');
  });

  it('should return one category by ID', async () => {
    mockRepo.findOne.mockResolvedValue(mockCategory);
    const result = await service.findOne(1);
    expect(result).toEqual(mockCategory);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, relations: ['nfts'] });
  });

  it('should throw if category not found on findOne', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow('Category not found');
  });

  it('should return all categories', async () => {
    mockRepo.find.mockResolvedValue([mockCategory]);
    const result = await service.findAll();
    expect(result).toEqual([mockCategory]);
    expect(repo.find).toHaveBeenCalledWith({ relations: ['nfts'] });
  });
});
