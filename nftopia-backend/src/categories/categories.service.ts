// src/categories/category.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto/create-category.dto';


@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = this.categoryRepository.create(createCategoryDto);
    await this.categoryRepository.save(category);
    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new Error('Category not found');
    }
    Object.assign(category, updateCategoryDto);
    await this.categoryRepository.save(category);
    return category;
  }

  async findOne(id: number): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findOne({where: { id }, relations: ['nfts'] });
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }

  async findAll(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryRepository.find({ relations: ['nfts'] });
    return categories;
  }
}
