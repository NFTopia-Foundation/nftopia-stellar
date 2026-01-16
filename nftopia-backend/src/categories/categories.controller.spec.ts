import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto/create-category.dto';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;

  const mockCategory: CategoryResponseDto = {
    id: 1,
    name: 'Art',
    description: 'All about art',
  };

  const mockService = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should create a category', async () => {
    const dto: CreateCategoryDto = { name: 'Art', description: 'All about art' };
    mockService.create.mockResolvedValue(mockCategory);

    const result = await controller.create(dto);
    expect(result).toEqual(mockCategory);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should update a category', async () => {
    const dto: UpdateCategoryDto = { name: 'Updated', description: 'Updated desc' };
    const updatedCategory = { ...mockCategory, ...dto };
    mockService.update.mockResolvedValue(updatedCategory);

    const result = await controller.update(1, dto);
    expect(result).toEqual(updatedCategory);
    expect(service.update).toHaveBeenCalledWith(1, dto);
  });

  it('should return all categories', async () => {
    mockService.findAll.mockResolvedValue([mockCategory]);
    const result = await controller.findAll();
    expect(result).toEqual([mockCategory]);
  });

  it('should return a category by id', async () => {
    mockService.findOne.mockResolvedValue(mockCategory);
    const result = await controller.findOne(1);
    expect(result).toEqual(mockCategory);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });
});
