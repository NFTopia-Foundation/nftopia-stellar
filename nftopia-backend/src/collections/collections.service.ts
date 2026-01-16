import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collection } from './entities/collection.entity';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/create-collection.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // Create new collection
  async createCollection(
    dto: CreateCollectionDto,
    userId: string,
  ): Promise<Collection> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const collection = this.collectionRepo.create({
      ...dto,
      creator: user,
    });

    return this.collectionRepo.save(collection);
  }


  async createCollectionJson(
    dto: CreateCollectionDto, // includes name, description, and bannerImage (as string URL)
    userId: string,
  ): Promise<Collection> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
  
    const collection = this.collectionRepo.create({
      ...dto, // dto.bannerImage is already the Firebase URL
      creator: user,
    });
  
    return this.collectionRepo.save(collection);
  }
  

  // Get all collections (optional: with pagination later)
  async getAllCollections(): Promise<Collection[]> {
    return this.collectionRepo.find({
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  // Get a single collection by ID
  async getCollectionById(id: string): Promise<Collection> {
    const collection = await this.collectionRepo.findOne({
      where: { id },
      relations: ['creator', 'nfts'],
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }

  // Update collection (only by its creator)
  async updateCollection(
    id: string,
    dto: UpdateCollectionDto,
    userId: string,
  ): Promise<Collection> {
    const collection = await this.collectionRepo.findOne({
      where: { id },
      relations: ['creator'],
    });
    if (!collection) throw new NotFoundException('Collection not found');

    if (collection.creator.id !== userId)
      throw new UnauthorizedException('You are not the creator');

    Object.assign(collection, dto);
    return this.collectionRepo.save(collection);
  }

  // Delete collection (only by its creator)
  async deleteCollection(id: string, userId: string): Promise<void> {
    const collection = await this.collectionRepo.findOne({
      where: { id },
      relations: ['creator'],
    });
    if (!collection) throw new NotFoundException('Collection not found');

    if (collection.creator.id !== userId)
      throw new UnauthorizedException('You are not authorized');

    await this.collectionRepo.remove(collection);
  }

  // Get all collections by a specific user
  async getCollectionsByUser(userId: string): Promise<Collection[]> {
    return this.collectionRepo.find({
      where: { creator: { id: userId } },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }
}
