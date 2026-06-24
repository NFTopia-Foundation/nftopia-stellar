import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerService } from './indexer.service';
import { ContractEventIndexerJob } from './contract-event-indexer.job';
import { DlqRetryWorker } from './dlq-retry.worker';
import { DlqController } from './dlq.controller';
import { SystemSettings } from './system-settings.entity';
import { ContractEvent } from './entities/contract-event.entity';
import { ContractEventDlq } from './entities/contract-event-dlq.entity';
import { StellarNft } from '../nft/entities/stellar-nft.entity';
import { StellarModule } from '../modules/stellar/stellar.module';
import { NftTransferEvent } from './entities/nft-transfer-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemSettings,
      StellarNft,
      ContractEvent,
      ContractEventDlq,
      NftTransferEvent,
    ]),
    StellarModule,
  ],
  controllers: [DlqController],
  providers: [IndexerService, ContractEventIndexerJob, DlqRetryWorker],
  exports: [IndexerService, ContractEventIndexerJob, DlqRetryWorker],
})
export class IndexerModule {}
