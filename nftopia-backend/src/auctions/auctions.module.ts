import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { NFT } from '../nfts/entities/nft.entity';
import { User } from '../users/entities/user.entity';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Auction, NFT, User])],
  controllers: [AuctionsController],
  providers: [AuctionsService],
  exports: [AuctionsService],
})
export class AuctionsModule {}
