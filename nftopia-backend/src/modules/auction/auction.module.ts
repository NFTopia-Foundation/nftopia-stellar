import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Auction, Bid, StellarNft])],
  providers: [AuctionService],
  controllers: [AuctionController],
})
export class AuctionModule {}
