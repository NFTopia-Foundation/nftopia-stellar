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
import { AuctionService } from './auction.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { AuctionStatus } from './interfaces/auction.interface';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { Request as ExpressRequest } from 'express';

@Controller('auctions')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Get()
  async list(@Query() query: AuctionQueryDto) {
    return this.auctionService.findAll(query);
  }

  @Get('active')
  async active(@Query() query: AuctionQueryDto) {
    return this.auctionService.findAll({
      ...query,
      status: AuctionStatus.ACTIVE,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.auctionService.findOne(id);
  }

  @Get(':id/bids')
  async bids(@Param('id') id: string) {
    return this.auctionService.getBids(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateAuctionDto,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const sellerId = req.user?.userId;
    return this.auctionService.create(dto, sellerId as string);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/bids')
  async placeBid(
    @Param('id') id: string,
    @Body() dto: PlaceBidDto,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const bidderId = req.user?.userId;
    return this.auctionService.placeBid(id, bidderId as string, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async cancel(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const userId = req.user?.userId;
    return this.auctionService.cancelAuction(id, userId as string);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/settle')
  async settle(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const callerId = req.user?.userId;
    return this.auctionService.settleAuction(id, callerId as string);
  }
}
