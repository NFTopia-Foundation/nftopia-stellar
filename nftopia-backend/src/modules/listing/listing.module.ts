import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity';
import { ListingService } from './listing.service';
import { ListingController } from './listing.controller';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { NftMetadata } from '../../nft/entities/nft-metadata.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, StellarNft, NftMetadata])],
  providers: [ListingService],
  controllers: [ListingController],
})
export class ListingModule {}
