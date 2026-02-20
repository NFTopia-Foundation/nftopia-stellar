import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArweaveService } from './arweave.service';
import { IpfsService } from './ipfs.service';
import { STORAGE_RETRY_QUEUE } from './storage.constants';
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
  computeFileHash,
  validateFileForStorage,
} from './validators/file.validator';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @InjectRepository(StoredAsset)
    private readonly storedAssetRepository: Repository<StoredAsset>,
    private readonly ipfsService: IpfsService,
    private readonly arweaveService: ArweaveService,
    private readonly configService: ConfigService,
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
    const fileHash = computeFileHash(file.buffer);

    const existing = await this.storedAssetRepository.findOne({
      where: { fileHash },
    });

    if (existing) {
      return this.mapEntityToResult(existing, storageConfig);
    }

    let ipfsResult: { cid: string; uri: string; gatewayUrl: string } | null = null;
    let arweaveResult: { id: string; uri: string; gatewayUrl: string } | null = null;
    let lastError: unknown;

    if (validation.ipfsEligible) {
      try {
        ipfsResult = await retryWithBackoff(() => this.ipfsService.upload(file), {
          attempts: storageConfig.ipfs.retryAttempts,
          baseDelayMs: storageConfig.ipfs.retryBackoffMs,
          onRetry: (error, attempt, delayMs) => {
            this.logger.warn(
              `Retrying IPFS upload (attempt=${attempt + 1}, delayMs=${delayMs}): ${this.getErrorMessage(error)}`,
            );
          },
        });
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

    const entity = this.storedAssetRepository.create({
      fileHash,
      ipfsCid: ipfsResult?.cid ?? null,
      arweaveId: arweaveResult?.id ?? null,
      primaryStorage: ipfsResult ? 'ipfs' : 'arweave',
      fileSize: String(file.size),
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      uploadedBy,
      metadata: metadata ?? null,
    });

    const saved = await this.storedAssetRepository.save(entity);
    return this.mapEntityToResult(saved, storageConfig);
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
          ? toArweaveGatewayUrl(entity.arweaveId, storageConfig.arweave.gatewayUrl)
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
