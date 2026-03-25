import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { ListingService } from './listing.service';
import { MarketplaceController } from './marketplace.controller';
import { AuctionService } from './marketplace.service';
import { Auction } from './entities/auction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Auction, Listing])],
  controllers: [MarketplaceController],
  providers: [AuctionService, ListingService],
  exports: [AuctionService, ListingService],
})
export class MarketplaceModule {}
