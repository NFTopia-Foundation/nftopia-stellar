import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { NftMetadata } from '../../nft/entities/nft-metadata.entity';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Auction, Bid, StellarNft, NftMetadata]),
    StellarModule,
  ],
  providers: [AuctionService],
  controllers: [AuctionController],
  exports: [AuctionService],
})
export class AuctionModule {}
