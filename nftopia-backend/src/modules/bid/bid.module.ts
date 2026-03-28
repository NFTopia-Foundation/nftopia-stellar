import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Bid } from '../auction/entities/bid.entity';
import { Auction } from '../auction/entities/auction.entity';
import { User } from '../../users/user.entity';
import { BidService } from './bid.service';
import { BidController } from './bid.controller';
import { BidGateway } from './bid.gateway';
import { BidEventListener } from './listeners/bid-event.listener';
import { StellarSignatureStrategy } from '../../auth/strategies/stellar.strategy';

@Module({
  imports: [TypeOrmModule.forFeature([Bid, Auction, User])],
  providers: [
    BidService,
    BidGateway,
    BidEventListener,
    StellarSignatureStrategy,
  ],
  controllers: [BidController],
  exports: [BidService],
})
export class BidModule {}
