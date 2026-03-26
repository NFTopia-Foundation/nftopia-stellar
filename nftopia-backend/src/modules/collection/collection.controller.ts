import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionQueryDto } from './dto/collection-query.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('api/v1/collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  async findAll(@Query() query: CollectionQueryDto) {
    return await this.collectionService.findAll(query);
  }

  @Get('top')
  async getTopCollections(@Query('limit', ParseIntPipe) limit: number = 10) {
    return await this.collectionService.getTopCollections(limit);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.collectionService.findOne(id);
  }

  @Get('contract/:address')
  async findByContractAddress(@Param('address') address: string) {
    return await this.collectionService.findByContractAddress(address);
  }

  @Get(':id/stats')
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return await this.collectionService.getStats(id);
  }

  @Get(':id/nfts')
  async getNftsInCollection(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return await this.collectionService.getNftsInCollection(id, page, limit);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCollectionDto: CreateCollectionDto,
    @Request() req,
  ) {
    return await this.collectionService.create(
      createCollectionDto,
      req.user.userId,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
    @Request() req,
  ) {
    return await this.collectionService.update(
      id,
      updateCollectionDto,
      req.user.userId,
    );
  }
}
