import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Put,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/create-collection.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
//   import { Request } from 'express';
import { RequestWithUser } from '../types/RequestWithUser';


@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionService: CollectionsService) {}

  // Create a new collection
  @UseGuards(JwtAuthGuard)
  @Post()
  async createCollection(
    @Body() dto: CreateCollectionDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user['sub'];
    const collection = await this.collectionService.createCollection(dto, userId);
    return { message: 'Collection created successfully', collection };
  }

  @UseGuards(JwtAuthGuard)
  @Post("create")
  async createCollectionJson(
    @Body() dto: CreateCollectionDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.sub;
    const collection = await this.collectionService.createCollectionJson(dto, userId);
    return { message: 'Collection created successfully', collection };
  }

  // Get all collections
  @Get()
  async getAllCollections() {
    const collections = await this.collectionService.getAllCollections();
    return { collections };
  }

  // Get collection by ID
  @Get(':id')
  async getCollectionById(@Param('id', new ParseUUIDPipe()) id: string) {
    const collection = await this.collectionService.getCollectionById(id);
    return { collection };
  }

  // Update a collection
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateCollection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCollectionDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user['sub'];
    const updated = await this.collectionService.updateCollection(id, dto, userId);
    return { message: 'Collection updated successfully', collection: updated };
  }

  // Delete a collection
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCollection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user['sub'];
    await this.collectionService.deleteCollection(id, userId);
  }

  // Get collections by user ID
  @Get('/user/:userId')
  async getCollectionsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    const collections = await this.collectionService.getCollectionsByUser(userId);
    return { collections };
  }
}
