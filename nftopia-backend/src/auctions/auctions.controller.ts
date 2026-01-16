// auctions.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { UUIDPipe } from '../utils/uuid-pipe';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Post()
  async create(@Body() body: { nftId: string; startTime: string; endTime: string }) {
    const auction = await this.auctionsService.createAuction(
      body.nftId,
      new Date(body.startTime),
      new Date(body.endTime),
    );
    return { message: 'Auction created', auction };
  }

  @Get('active')
  async activeAuctions() {
    const auctions = await this.auctionsService.getActiveAuctions();
    return { auctions };
  }

  @Get(':id')
  async getAuction(@Param('id', UUIDPipe) id: string) {
    const auction = await this.auctionsService.getAuction(id);
    return { auction };
  }
}
