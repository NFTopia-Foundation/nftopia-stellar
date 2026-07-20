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
  Res,
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
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateNftDto } from './dto/create-nft.dto';
import { NftImageQueryDto } from './dto/nft-image-query.dto';
import { NftQueryDto } from './dto/nft-query.dto';
import { UpdateNftDto } from './dto/update-nft.dto';
import { NftMediaService } from './nft-media.service';
import { NftService } from './nft.service';

@ApiTags('nft')
@Controller('nfts')
export class NftController {
  constructor(
    private readonly nftService: NftService,
    private readonly nftMediaService: NftMediaService,
  ) {}

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

  @Get(':id/image')
  @ApiOperation({ summary: 'Get optimized NFT image variant' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @ApiQuery({ name: 'width', required: false, example: 400 })
  @ApiQuery({ name: 'height', required: false, example: 400 })
  @ApiQuery({ name: 'quality', required: false, example: 82 })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['auto', 'webp', 'avif', 'jpeg', 'png', 'original'],
  })
  async getImage(
    @Param('id') id: string,
    @Query() query: NftImageQueryDto,
    @Req() req: ExpressRequest,
    @Res() res: ExpressResponse,
  ) {
    const result = await this.nftMediaService.getOptimizedImage(
      id,
      query,
      req.headers.accept,
    );

    res.setHeader('Cache-Control', result.cacheControl);

    if ('redirectUrl' in result) {
      return res.redirect(302, result.redirectUrl);
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('X-Original-Bytes', result.originalBytes);
    res.setHeader('X-Optimized-Bytes', result.optimizedBytes);
    return res.send(result.buffer);
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
