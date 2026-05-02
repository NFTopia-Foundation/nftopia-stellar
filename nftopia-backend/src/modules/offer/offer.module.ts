import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from './entities/offer.entity';
import { OfferService } from './offer.service';
import { OfferController } from './offer.controller';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { UsersModule } from '../../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Offer, StellarNft]),
    UsersModule,
    NotificationsModule,
    StellarModule,
  ],
  providers: [OfferService],
  controllers: [OfferController],
  exports: [OfferService],
})
export class OfferModule {}
