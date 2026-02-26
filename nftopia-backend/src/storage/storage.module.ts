import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArweaveService } from './arweave.service';
import { StoredAsset } from './entities/stored-asset.entity';
import { IpfsService } from './ipfs.service';
import { InMemoryRetryQueueService } from './retry/in-memory-retry-queue.service';
import { STORAGE_RETRY_QUEUE } from './storage.constants';
import { StorageService } from './storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoredAsset])],
  providers: [
    IpfsService,
    ArweaveService,
    InMemoryRetryQueueService,
    StorageService,
    {
      provide: STORAGE_RETRY_QUEUE,
      useExisting: InMemoryRetryQueueService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
