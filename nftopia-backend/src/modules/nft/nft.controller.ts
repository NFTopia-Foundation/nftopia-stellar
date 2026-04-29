import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateNftDto } from './dto/create-nft.dto';
import { NftQueryDto } from './dto/nft-query.dto';
import { UpdateNftDto } from './dto/update-nft.dto';
import { NftService } from './nft.service';

@ApiTags('nft')
@Controller('nfts')
export class NftController {
  constructor(private readonly nftService: NftService) {}

  @Get()
  @ApiOperation({ summary: 'List NFTs with pagination and filters' })
  async findAll(@Query() query: NftQueryDto) {
    return this.nftService.findAll(query);
  }

  @Get('token/:tokenId')
  @ApiOperation({ summary: 'Get NFT by token ID' })
  @ApiParam({ name: 'tokenId', description: 'NFT token ID' })
  async findByTokenId(@Param('tokenId') tokenId: string) {
    return this.nftService.findByTokenId(tokenId);
  }

  @Get('owner/:ownerId')
  @ApiOperation({ summary: 'Get NFTs by owner' })
  @ApiParam({ name: 'ownerId', description: 'Owner user ID' })
  async findByOwner(
    @Param('ownerId') ownerId: string,
    @Query() query: NftQueryDto,
  ) {
    return this.nftService.findByOwner(ownerId, query);
  }

  @Get('collection/:collectionId')
  @ApiOperation({ summary: 'Get NFTs by collection' })
  @ApiParam({ name: 'collectionId', description: 'Collection ID' })
  async findByCollection(
    @Param('collectionId') collectionId: string,
    @Query() query: NftQueryDto,
  ) {
    return this.nftService.findByCollection(collectionId, query);
  }

  @Get(':id/attributes')
  @ApiOperation({ summary: 'Get NFT attributes' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  async getAttributes(@Param('id') id: string) {
    return this.nftService.getAttributes(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get NFT by ID' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  async findById(@Param('id') id: string) {
    return this.nftService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Mint a new NFT' })
  async mint(
    @Body() dto: CreateNftDto,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const callerId = req.user?.userId as string;
    return this.nftService.mint(dto, callerId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update NFT metadata' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNftDto,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const callerId = req.user?.userId as string;
    return this.nftService.update(id, dto, callerId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Burn NFT' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @ApiQuery({
    name: 'soft',
    required: false,
    description: 'Reserved query parameter for client compatibility',
  })
  async burn(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const callerId = req.user?.userId as string;
    return this.nftService.burn(id, callerId);
  }
}
