import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArweaveService } from './arweave.service';
import { StoredAsset } from './entities/stored-asset.entity';
import { IpfsService } from './ipfs.service';
import { InMemoryRetryQueueService } from './retry/in-memory-retry-queue.service';
import { ScanAdminController } from './scan-admin.controller';
import { FileInspectorService } from './scanning/file-inspector.service';
import { MalwareScannerService } from './scanning/malware-scanner.service';
import { RescanJob } from './scanning/rescan.job';
import { ScanAlertService } from './scanning/scan-alert.service';
import { STORAGE_RETRY_QUEUE } from './storage.constants';
import { StorageService } from './storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoredAsset])],
  controllers: [ScanAdminController],
  providers: [
    IpfsService,
    ArweaveService,
    InMemoryRetryQueueService,
    FileInspectorService,
    MalwareScannerService,
    ScanAlertService,
    RescanJob,
    StorageService,
    {
      provide: STORAGE_RETRY_QUEUE,
      useExisting: InMemoryRetryQueueService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
