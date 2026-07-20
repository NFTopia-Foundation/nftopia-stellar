import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { StoredAsset } from '../entities/stored-asset.entity';
import { getStorageConfig } from '../storage.config';
import { toArweaveGatewayUrl, toIpfsGatewayUrl } from '../utils/uri.utils';
import { MalwareScannerService } from './malware-scanner.service';
import { ScanAlertService } from './scan-alert.service';

@Injectable()
export class RescanJob {
  private readonly logger = new Logger(RescanJob.name);

  constructor(
    @InjectRepository(StoredAsset)
    private readonly storedAssetRepository: Repository<StoredAsset>,
    private readonly configService: ConfigService,
    private readonly malwareScanner: MalwareScannerService,
    private readonly scanAlert: ScanAlertService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron(): Promise<void> {
    const count = await this.rescanStaleAssets();
    if (count > 0) {
      this.logger.log(`Periodic rescan processed ${count} asset(s)`);
    }
  }

  /** Re-scans previously clean assets whose last scan is older than the configured staleness window. */
  async rescanStaleAssets(): Promise<number> {
    const storageConfig = getStorageConfig(this.configService);
    if (!storageConfig.scanning.enabled) {
      return 0;
    }

    const staleBefore = new Date(
      Date.now() - storageConfig.scanning.rescanStaleAfterMs,
    );

    const candidates = await this.storedAssetRepository.find({
      where: {
        scanStatus: 'clean',
        quarantined: false,
        scannedAt: LessThan(staleBefore),
      },
      order: { scannedAt: 'ASC' },
      take: storageConfig.scanning.rescanBatchSize,
    });

    for (const asset of candidates) {
      await this.rescanAsset(asset);
    }

    return candidates.length;
  }

  /** Triggers an on-demand rescan of a single asset, e.g. from the admin panel. */
  async rescanAssetById(assetId: string): Promise<void> {
    const asset = await this.storedAssetRepository.findOne({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(`Stored asset ${assetId} not found`);
    }

    await this.rescanAsset(asset);
  }

  private async rescanAsset(asset: StoredAsset): Promise<void> {
    const storageConfig = getStorageConfig(this.configService);
    const sourceUrl = asset.ipfsCid
      ? toIpfsGatewayUrl(asset.ipfsCid, storageConfig.ipfs.gatewayUrl)
      : asset.arweaveId
        ? toArweaveGatewayUrl(asset.arweaveId, storageConfig.arweave.gatewayUrl)
        : null;

    if (!sourceUrl) {
      return;
    }

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Gateway responded with status ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const scanResult = await this.malwareScanner.scan(buffer);
      const isMalicious =
        scanResult.status === 'infected' || scanResult.status === 'suspicious';

      await this.storedAssetRepository.update(asset.id, {
        scanStatus: scanResult.status,
        scanResult,
        scannedAt: new Date(scanResult.scannedAt),
        quarantined: isMalicious,
      });

      if (isMalicious) {
        await this.scanAlert.notifyMalwareDetected({
          assetId: asset.id,
          fileHash: asset.fileHash,
          uploadedBy: asset.uploadedBy,
          originalFilename: asset.originalFilename,
          scanResult,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Rescan failed for asset=${asset.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
