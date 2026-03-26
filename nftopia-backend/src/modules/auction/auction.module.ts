import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { NftMetadata } from '../../nft/entities/nft-metadata.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Auction, Bid, StellarNft, NftMetadata])],
  providers: [AuctionService],
  controllers: [AuctionController],
})
export class AuctionModule {}
