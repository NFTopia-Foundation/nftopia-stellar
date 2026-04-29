import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerService } from './indexer.service';
import { SystemSettings } from './system-settings.entity';
import { StellarNft } from '../nft/entities/stellar-nft.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings, StellarNft])],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
