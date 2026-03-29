import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OfferService } from './offer.service';
import { CreateOfferDto, AcceptOfferDto } from './dto/offer.dto';
import { Offer } from './entities/offer.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Marketplace Offers')
@Controller('marketplace')
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Post('offers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new offer for an NFT' })
  @ApiResponse({ status: 201, description: 'Offer created' })
  async create(@Body() createOfferDto: CreateOfferDto): Promise<Offer> {
    return this.offerService.createOffer(createOfferDto);
  }

  @Get('nfts/:id/offers')
  @ApiOperation({ summary: 'Get all active offers for an NFT' })
  async getOffers(@Param('id') id: string): Promise<Offer[]> {
    const nftToken = id.split(':')[1];
    const nftContract = id.split(':')[0];
    return this.offerService.getOffersByNft(nftContract, nftToken);
  }

  @Put('offers/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an offer' })
  @ApiResponse({
    status: 200,
    description: 'Offer accepted, returns Stellar XDR',
  })
  async accept(
    @Param('id') id: string,
    @Body() acceptOfferDto: AcceptOfferDto,
  ): Promise<{ xdr: string; offer: Offer }> {
    return this.offerService.acceptOffer(id, acceptOfferDto.ownerPublicKey);
  }
}
