import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { Request as ExpressRequest } from 'express';

type AuthReq = ExpressRequest & { user?: { userId?: string } };

@Controller('marketplace')
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  /**
   * POST /marketplace/offers
   * Create a binding XLM offer on any NFT (authenticated).
   */
  @UseGuards(JwtAuthGuard)
  @Post('offers')
  async createOffer(@Body() dto: CreateOfferDto, @Req() req: AuthReq) {
    const bidderId = req.user?.userId as string;
    return this.offerService.create(dto, bidderId);
  }

  /**
   * GET /marketplace/nfts/:id/offers
   * List active (non-expired, pending) offers for an NFT.
   * :id is in the form contractId:tokenId
   */
  @Get('nfts/:id/offers')
  async listOffers(@Param('id') id: string) {
    const [contractId, ...tokenParts] = id.split(':');
    const tokenId = tokenParts.join(':');
    return this.offerService.findByNft(contractId, tokenId);
  }

  /**
   * PUT /marketplace/offers/:id/accept
   * Accept an offer (authenticated – must be the NFT owner).
   */
  @UseGuards(JwtAuthGuard)
  @Put('offers/:id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptOffer(@Param('id') id: string, @Req() req: AuthReq) {
    const ownerId = req.user?.userId as string;
    return this.offerService.accept(id, ownerId);
  }

  /**
   * DELETE /marketplace/offers/:id
   * Cancel a pending offer (authenticated – must be the offer creator).
   */
  @UseGuards(JwtAuthGuard)
  @Delete('offers/:id')
  @HttpCode(HttpStatus.OK)
  async cancelOffer(@Param('id') id: string, @Req() req: AuthReq) {
    const bidderId = req.user?.userId as string;
    return this.offerService.cancel(id, bidderId);
  }

  /**
   * GET /marketplace/offers/:id
   * Get a single offer by ID.
   */
  @Get('offers/:id')
  async getOffer(@Param('id') id: string) {
    return this.offerService.findOne(id);
  }
}
