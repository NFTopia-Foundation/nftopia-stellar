import { Controller, Post, Get, Param, Body, Req, UseGuards } from '@nestjs/common';
import { BidsService } from './bids.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RequestWithUser } from '../types/RequestWithUser';
import { UUIDPipe } from '../utils/uuid-pipe';

@Controller('bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':auctionId')
  async placeBid(
    @Param('auctionId', UUIDPipe) auctionId: string,
    @Body('amount') amount: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.sub;
    const bid = await this.bidsService.placeBid(userId, auctionId, amount);
    return { message: 'Bid placed', bid };
  }

  @Get('auction/:auctionId')
  async getBids(@Param('auctionId', UUIDPipe) auctionId: string) {
    const bids = await this.bidsService.getBidsForAuction(auctionId);
    return { bids };
  }

  @Get('highest/:auctionId')
  async getHighestBid(@Param('auctionId', UUIDPipe) auctionId: string) {
    const highest = await this.bidsService.getHighestBid(auctionId);
    return { highest };
  }
}
