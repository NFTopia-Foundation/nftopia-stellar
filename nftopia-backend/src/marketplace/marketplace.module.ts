import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { ListingService } from './listing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  providers: [ListingService],
  exports: [ListingService],
})
export class MarketplaceModule {}
