import { Module } from '@nestjs/common';
import { NftService } from './nft.service';
import { NftController } from './nft.controller';
import { SorobanService } from './soroban.service';
import { ScheduleModule } from '@nestjs/schedule';

import { TypeOrmModule } from '@nestjs/typeorm';
import { StellarNft } from './entities/stellar-nft.entity';
import { NftMetadata } from './entities/nft-metadata.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([StellarNft, NftMetadata]),
  ],
  controllers: [NftController],
  providers: [NftService, SorobanService],
  exports: [NftService, SorobanService],
})
export class NftModule {}
