import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BidsService } from './bids.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BidQueryDto } from './dto/bid-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StellarSignatureGuard } from '../auth/stellar-signature.guard';

interface RequestWithUser extends Request {
  user?: { publicKey: string };
  signedBidPublicKey?: string;
}

@Controller('bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Post(':auctionId')
  @UseGuards(JwtAuthGuard, StellarSignatureGuard)
  async placeBid(
    @Param('auctionId') auctionId: string,
    @Body() dto: PlaceBidDto,
    @Request() req: RequestWithUser,
  ) {
    const publicKey = req.signedBidPublicKey ?? req.user?.publicKey;
    if (!publicKey) {
      throw new Error('Missing bidder public key');
    }
    return this.bidsService.placeBid(auctionId, dto, publicKey);
  }

  @Get('auction/:auctionId')
  async getBidsByAuction(
    @Param('auctionId') auctionId: string,
    @Query() query: BidQueryDto,
  ) {
    return this.bidsService.getBidsByAuction(auctionId, query);
  }

  @Get('highest/:auctionId')
  async getHighestBid(@Param('auctionId') auctionId: string) {
    return this.bidsService.getHighestBid(auctionId);
  }

  @Get('my/:auctionId')
  @UseGuards(JwtAuthGuard)
  async getMyBids(
    @Param('auctionId') auctionId: string,
    @Request() req: RequestWithUser,
  ) {
    const publicKey = req.user?.publicKey;
    if (!publicKey) {
      throw new Error('Unauthorized');
    }
    return this.bidsService.getMyBids(auctionId, publicKey);
  }
}
