import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { ListingStatus } from './interfaces/listing.interface';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { Request as ExpressRequest } from 'express';

@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Get()
  async list(@Query() query: ListingQueryDto) {
    return this.listingService.findAll(query);
  }

  @Get('active')
  async active(@Query() query: ListingQueryDto) {
    return this.listingService.findAll({
      ...query,
      status: ListingStatus.ACTIVE,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.listingService.findOne(id);
  }

  @Get('nft/:nftId')
  async byNft(@Param('nftId') nftId: string) {
    // nftId expected as contractId:tokenId or similar; user can split if needed
    const [contractId, tokenId] = nftId.split(':');
    return this.listingService.findByNft(contractId, tokenId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateListingDto,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const sellerId = req.user?.userId as string;
    return this.listingService.create(dto, sellerId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async cancel(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const userId = req.user?.userId as string;
    return this.listingService.cancel(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/buy')
  async buy(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const buyerId = req.user?.userId as string;
    return this.listingService.buy(id, buyerId);
  }
}
