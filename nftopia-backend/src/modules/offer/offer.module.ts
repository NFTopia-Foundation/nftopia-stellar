import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';
import { Offer } from './entities/offer.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, StellarNft])],
  controllers: [OfferController],
  providers: [OfferService],
  exports: [OfferService],
})
export class OfferModule {}
