import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ArweaveService } from './arweave.service';
import { IpfsService } from './ipfs.service';
import { FileInspectorService } from './scanning/file-inspector.service';
import { MalwareScannerService } from './scanning/malware-scanner.service';
import { ScanAlertService } from './scanning/scan-alert.service';
import type { ScanResult } from './scanning/scan.types';
import {
  SCAN_EXEMPT_MIME_TYPES,
  STORAGE_RETRY_QUEUE,
} from './storage.constants';
import { getStorageConfig } from './storage.config';
import { StoredAsset } from './entities/stored-asset.entity';
import type { RetryQueue } from './interfaces/retry-queue.interface';
import type {
  RetryProvider,
  StorageConfig,
  StoredAssetResult,
  UploadedFile,
} from './storage.types';
import { retryWithBackoff } from './utils/retry.util';
import {
  toArweaveGatewayUrl,
  toArweaveUri,
  toIpfsGatewayUrl,
  toIpfsUri,
} from './utils/uri.utils';
import {
  assertAllowedMimeType,
  computeFileHash,
  validateFileForStorage,
} from './validators/file.validator';

const PENDING_SCAN_EVENT = 'storage.scan.pending';

interface PendingScanEvent {
  assetId: string;
  file: UploadedFile;
  fileHash: string;
  uploadedBy: string;
  metadata?: Record<string, unknown>;
  ipfsEligible: boolean;
}

interface UploadOutcome {
  ipfsResult: { cid: string; uri: string; gatewayUrl: string } | null;
  arweaveResult: { id: string; uri: string; gatewayUrl: string } | null;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @InjectRepository(StoredAsset)
    private readonly storedAssetRepository: Repository<StoredAsset>,
    private readonly ipfsService: IpfsService,
    private readonly arweaveService: ArweaveService,
    private readonly configService: ConfigService,
    private readonly fileInspector: FileInspectorService,
    private readonly malwareScanner: MalwareScannerService,
    private readonly scanAlert: ScanAlertService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(STORAGE_RETRY_QUEUE)
    private readonly retryQueue: RetryQueue,
  ) {}

  async storeAsset(
    file: UploadedFile,
    uploadedBy: string,
    metadata?: Record<string, unknown>,
  ): Promise<StoredAssetResult> {
    if (!uploadedBy || uploadedBy.trim().length === 0) {
      throw new BadRequestException('uploadedBy is required');
    }

    const storageConfig = getStorageConfig(this.configService);
    const validation = validateFileForStorage(file, storageConfig);

    const detectedMimeType = assertAllowedMimeType(
      this.fileInspector.detectMimeType(file.buffer, file.mimetype),
    );

    const sanitizedBuffer = await this.fileInspector.sanitize(
      file.buffer,
      detectedMimeType,
    );
    const sanitizedFile: UploadedFile = {
      ...file,
      mimetype: detectedMimeType,
      buffer: sanitizedBuffer,
      size: sanitizedBuffer.length,
    };
    const ipfsEligible =
      sanitizedFile.size <= storageConfig.ipfs.maxFileSizeBytes &&
      validation.ipfsEligible;

    const fileHash = computeFileHash(sanitizedFile.buffer);

    const existing = await this.storedAssetRepository.findOne({
      where: { fileHash },
    });

    if (existing) {
      if (existing.quarantined) {
        throw new BadRequestException(
          'This file was previously flagged by malware scanning and cannot be stored',
        );
      }

      return this.mapEntityToResult(existing, storageConfig);
    }

    if (sanitizedFile.size > storageConfig.scanning.asyncThresholdBytes) {
      return this.storeAssetPendingScan(
        sanitizedFile,
        fileHash,
        uploadedBy,
        metadata,
        ipfsEligible,
        storageConfig,
      );
    }

    const scanResult = await this.scanBuffer(
      sanitizedFile.buffer,
      detectedMimeType,
    );

    if (
      scanResult.status === 'infected' ||
      scanResult.status === 'suspicious'
    ) {
      await this.quarantineAsset(
        sanitizedFile,
        fileHash,
        uploadedBy,
        metadata,
        scanResult,
      );
      throw new BadRequestException(
        'Uploaded file failed malware scanning and has been quarantined',
      );
    }

    if (scanResult.status === 'failed' && storageConfig.scanning.failClosed) {
      throw new ServiceUnavailableException(
        'Unable to verify file safety at this time, please retry',
      );
    }

    const { ipfsResult, arweaveResult } = await this.uploadWithFallback(
      sanitizedFile,
      fileHash,
      uploadedBy,
      metadata,
      ipfsEligible,
      storageConfig,
    );

    const entity = this.storedAssetRepository.create({
      fileHash,
      ipfsCid: ipfsResult?.cid ?? null,
      arweaveId: arweaveResult?.id ?? null,
      primaryStorage: ipfsResult ? 'ipfs' : 'arweave',
      fileSize: String(sanitizedFile.size),
      mimeType: sanitizedFile.mimetype,
      originalFilename: sanitizedFile.originalname,
      uploadedBy,
      metadata: metadata ?? null,
      scanStatus: scanResult.status,
      scanResult,
      quarantined: false,
      scannedAt: new Date(scanResult.scannedAt),
    });

    const saved = await this.storedAssetRepository.save(entity);
    return this.mapEntityToResult(saved, storageConfig);
  }

  private async storeAssetPendingScan(
    file: UploadedFile,
    fileHash: string,
    uploadedBy: string,
    metadata: Record<string, unknown> | undefined,
    ipfsEligible: boolean,
    storageConfig: StorageConfig,
  ): Promise<StoredAssetResult> {
    const entity = this.storedAssetRepository.create({
      fileHash,
      ipfsCid: null,
      arweaveId: null,
      primaryStorage: ipfsEligible ? 'ipfs' : 'arweave',
      fileSize: String(file.size),
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      uploadedBy,
      metadata: metadata ?? null,
      scanStatus: 'pending',
      scanResult: null,
      quarantined: false,
      scannedAt: null,
    });

    const saved = await this.storedAssetRepository.save(entity);

    this.eventEmitter.emit(PENDING_SCAN_EVENT, {
      assetId: saved.id,
      file,
      fileHash,
      uploadedBy,
      metadata,
      ipfsEligible,
    } satisfies PendingScanEvent);

    this.logger.log(
      `Queued async malware scan for large file hash=${fileHash} (size=${file.size})`,
    );

    return this.mapEntityToResult(saved, storageConfig);
  }

  @OnEvent(PENDING_SCAN_EVENT)
  async handlePendingScan(event: PendingScanEvent): Promise<void> {
    const storageConfig = getStorageConfig(this.configService);
    const scanResult = await this.scanBuffer(
      event.file.buffer,
      event.file.mimetype,
    );

    if (
      scanResult.status === 'infected' ||
      scanResult.status === 'suspicious'
    ) {
      await this.storedAssetRepository.update(event.assetId, {
        scanStatus: scanResult.status,
        scanResult,
        quarantined: true,
        scannedAt: new Date(scanResult.scannedAt),
      });

      await this.scanAlert.notifyMalwareDetected({
        assetId: event.assetId,
        fileHash: event.fileHash,
        uploadedBy: event.uploadedBy,
        originalFilename: event.file.originalname,
        scanResult,
      });
      return;
    }

    if (scanResult.status === 'failed' && storageConfig.scanning.failClosed) {
      await this.storedAssetRepository.update(event.assetId, {
        scanStatus: scanResult.status,
        scanResult,
        scannedAt: new Date(scanResult.scannedAt),
      });
      this.logger.error(
        `Async malware scan failed for asset=${event.assetId}; upload withheld pending manual rescan`,
      );
      return;
    }

    const updates: QueryDeepPartialEntity<StoredAsset> = {
      scanStatus: scanResult.status,
      scanResult,
      scannedAt: new Date(scanResult.scannedAt),
    };

    try {
      const { ipfsResult, arweaveResult } = await this.uploadWithFallback(
        event.file,
        event.fileHash,
        event.uploadedBy,
        event.metadata,
        event.ipfsEligible,
        storageConfig,
      );

      updates.ipfsCid = ipfsResult?.cid ?? null;
      updates.arweaveId = arweaveResult?.id ?? null;
      updates.primaryStorage = ipfsResult ? 'ipfs' : 'arweave';
    } catch (error) {
      // uploadWithFallback already enqueued a retry-queue entry; the asset
      // stays without a CID/ID until the retry worker succeeds.
      this.logger.error(
        `Async upload failed for asset=${event.assetId}: ${this.getErrorMessage(error)}`,
      );
    }

    await this.storedAssetRepository.update(event.assetId, updates);
  }

  private async scanBuffer(
    buffer: Buffer,
    mimeType: string,
  ): Promise<ScanResult> {
    if (SCAN_EXEMPT_MIME_TYPES.has(mimeType)) {
      return {
        status: 'skipped',
        engine: 'clamav',
        viruses: [],
        scannedAt: new Date().toISOString(),
      };
    }

    return this.malwareScanner.scan(buffer);
  }

  private async quarantineAsset(
    file: UploadedFile,
    fileHash: string,
    uploadedBy: string,
    metadata: Record<string, unknown> | undefined,
    scanResult: ScanResult,
  ): Promise<void> {
    const entity = this.storedAssetRepository.create({
      fileHash,
      ipfsCid: null,
      arweaveId: null,
      primaryStorage: 'ipfs',
      fileSize: String(file.size),
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      uploadedBy,
      metadata: metadata ?? null,
      scanStatus: scanResult.status,
      scanResult,
      quarantined: true,
      scannedAt: new Date(scanResult.scannedAt),
    });

    const saved = await this.storedAssetRepository.save(entity);

    await this.scanAlert.notifyMalwareDetected({
      assetId: saved.id,
      fileHash,
      uploadedBy,
      originalFilename: file.originalname,
      scanResult,
    });
  }

  private async uploadWithFallback(
    file: UploadedFile,
    fileHash: string,
    uploadedBy: string,
    metadata: Record<string, unknown> | undefined,
    ipfsEligible: boolean,
    storageConfig: StorageConfig,
  ): Promise<UploadOutcome> {
    let ipfsResult: UploadOutcome['ipfsResult'] = null;
    let arweaveResult: UploadOutcome['arweaveResult'] = null;
    let lastError: unknown;

    if (ipfsEligible) {
      try {
        ipfsResult = await retryWithBackoff(
          () => this.ipfsService.upload(file),
          {
            attempts: storageConfig.ipfs.retryAttempts,
            baseDelayMs: storageConfig.ipfs.retryBackoffMs,
            onRetry: (error, attempt, delayMs) => {
              this.logger.warn(
                `Retrying IPFS upload (attempt=${attempt + 1}, delayMs=${delayMs}): ${this.getErrorMessage(error)}`,
              );
            },
          },
        );
      } catch (error) {
        lastError = error;
        await this.enqueueRetry(
          'ipfs',
          file,
          fileHash,
          uploadedBy,
          metadata,
          storageConfig.ipfs.retryAttempts,
          error,
        );
      }
    } else {
      this.logger.warn(
        `IPFS max size exceeded for file hash=${fileHash}; falling back to Arweave`,
      );
    }

    if (!ipfsResult && storageConfig.fallbackEnabled) {
      try {
        arweaveResult = await retryWithBackoff(
          () => this.arweaveService.upload(file),
          {
            attempts: storageConfig.arweave.retryAttempts,
            baseDelayMs: storageConfig.arweave.retryBackoffMs,
            onRetry: (error, attempt, delayMs) => {
              this.logger.warn(
                `Retrying Arweave upload (attempt=${attempt + 1}, delayMs=${delayMs}): ${this.getErrorMessage(error)}`,
              );
            },
          },
        );
      } catch (error) {
        lastError = error;
        await this.enqueueRetry(
          'arweave',
          file,
          fileHash,
          uploadedBy,
          metadata,
          storageConfig.arweave.retryAttempts,
          error,
        );
      }
    }

    if (!ipfsResult && !arweaveResult) {
      await this.enqueueRetry(
        'combined',
        file,
        fileHash,
        uploadedBy,
        metadata,
        1,
        lastError ?? new Error('Unknown storage failure'),
      );

      throw new ServiceUnavailableException(
        'Unable to store asset using IPFS or Arweave',
      );
    }

    return { ipfsResult, arweaveResult };
  }

  private mapEntityToResult(
    entity: StoredAsset,
    storageConfig: StorageConfig,
  ): StoredAssetResult {
    return {
      ipfs: {
        cid: entity.ipfsCid,
        uri: entity.ipfsCid ? toIpfsUri(entity.ipfsCid) : null,
        gatewayUrl: entity.ipfsCid
          ? toIpfsGatewayUrl(entity.ipfsCid, storageConfig.ipfs.gatewayUrl)
          : null,
      },
      arweave: {
        id: entity.arweaveId,
        uri: entity.arweaveId ? toArweaveUri(entity.arweaveId) : null,
        gatewayUrl: entity.arweaveId
          ? toArweaveGatewayUrl(
              entity.arweaveId,
              storageConfig.arweave.gatewayUrl,
            )
          : null,
      },
      primary: entity.primaryStorage,
      size: Number.parseInt(entity.fileSize, 10),
      mimeType: entity.mimeType,
    };
  }

  private async enqueueRetry(
    provider: RetryProvider,
    file: UploadedFile,
    fileHash: string,
    uploadedBy: string,
    metadata: Record<string, unknown> | undefined,
    attempt: number,
    error: unknown,
  ): Promise<void> {
    const errorMessage = this.getErrorMessage(error);
    this.logger.warn(
      `Storage ${provider} upload failed for hash=${fileHash}: ${errorMessage}`,
    );

    await this.retryQueue.enqueue({
      provider,
      fileHash,
      uploadedBy,
      mimeType: file.mimetype,
      size: file.size,
      errorMessage,
      metadata,
      attempt,
    });
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
