import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { Bid } from './entities/bid.entity';
import { Auction } from './entities/auction.entity';
import { BidsGateway } from './bids.gateway';
import { BidEventListener } from './listeners/bid-event.listener';
import { SorobanModule } from '../soroban/soroban.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bid, Auction]),
    SorobanModule,
    AuthModule,
  ],
  controllers: [BidsController],
  providers: [BidsService, BidsGateway, BidEventListener],
  exports: [BidsService],
})
export class BidsModule {}
