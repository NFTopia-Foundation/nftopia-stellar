import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerService } from './indexer.service';
import { SystemSettings } from './system-settings.entity';
import { StellarNft } from '../nft/entities/stellar-nft.entity';
import { ContractEventDlq } from './contract-event-dlq.entity';
import { ContractEventDlqService } from './contract-event-dlq.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings, StellarNft, ContractEventDlq])],
  providers: [IndexerService, ContractEventDlqService],
  exports: [IndexerService, ContractEventDlqService],
})
export class IndexerModule {}
