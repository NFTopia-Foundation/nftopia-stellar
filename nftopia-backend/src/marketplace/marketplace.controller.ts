import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { AuctionService } from './marketplace.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly auctionService: AuctionService) {}

  @Post('auction')
  @ApiOperation({ summary: 'Create an English auction listing' })
  createAuction(@Body() dto: CreateAuctionDto) {
    return this.auctionService.createAuction(dto);
  }

  @Post('auction/:id/bid')
  @ApiOperation({ summary: 'Place a bid on an active auction' })
  placeBid(@Param('id') id: string, @Body() dto: PlaceBidDto) {
    return this.auctionService.placeBid(id, dto);
  }

  @Get('auction/:id')
  @ApiOperation({ summary: 'Get auction details by ID' })
  getAuction(@Param('id') id: string) {
    return this.auctionService.getAuctionById(id);
  }
}
