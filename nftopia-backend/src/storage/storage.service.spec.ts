import {
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArweaveService } from './arweave.service';
import { StoredAsset } from './entities/stored-asset.entity';
import { IpfsService } from './ipfs.service';
import type { RetryQueue } from './interfaces/retry-queue.interface';
import { STORAGE_RETRY_QUEUE } from './storage.constants';
import { StorageService } from './storage.service';
import type { StoredAssetResult, UploadedFile } from './storage.types';
import {
  toArweaveGatewayUrl,
  toArweaveUri,
  toIpfsGatewayUrl,
  toIpfsUri,
  toStellarMetadataUri,
} from './utils/uri.utils';

const createFile = (
  overrides: Partial<UploadedFile> = {},
): UploadedFile => {
  const buffer = overrides.buffer ?? Buffer.from('nftopia-storage-file');

  return {
    originalname: 'asset.png',
    mimetype: 'image/png',
    size: overrides.size ?? buffer.length,
    buffer,
    ...overrides,
    buffer,
    size: overrides.size ?? buffer.length,
  };
};

describe('StorageService', () => {
  let service: StorageService;
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let ipfsService: { upload: jest.Mock };
  let arweaveService: { upload: jest.Mock };
  let retryQueue: RetryQueue & { enqueue: jest.Mock };
  let configValues: Record<string, string>;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    configValues = {
      IPFS_PROVIDER: 'pinata',
      IPFS_GATEWAY_URL: 'https://ipfs.example/ipfs',
      IPFS_MAX_FILE_SIZE_BYTES: `${50 * 1024 * 1024}`,
      IPFS_RETRY_ATTEMPTS: '1',
      IPFS_RETRY_BACKOFF_MS: '0',
      ARWEAVE_GATEWAY_URL: 'https://arweave.example',
      ARWEAVE_MAX_FILE_SIZE_BYTES: `${100 * 1024 * 1024}`,
      ARWEAVE_RETRY_ATTEMPTS: '1',
      ARWEAVE_RETRY_BACKOFF_MS: '0',
      STORAGE_FALLBACK_ENABLED: 'true',
    };

    repository = {
      findOne: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn(),
    };

    ipfsService = {
      upload: jest.fn(),
    };

    arweaveService = {
      upload: jest.fn(),
    };

    retryQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      get: jest.fn((key: string) => configValues[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: getRepositoryToken(StoredAsset),
          useValue: repository,
        },
        {
          provide: IpfsService,
          useValue: ipfsService,
        },
        {
          provide: ArweaveService,
          useValue: arweaveService,
        },
        {
          provide: STORAGE_RETRY_QUEUE,
          useValue: retryQueue,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('rejects invalid MIME types', async () => {
    await expect(
      service.storeAsset(createFile({ mimetype: 'application/pdf' }), 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects files larger than Arweave max size', async () => {
    configValues.ARWEAVE_MAX_FILE_SIZE_BYTES = '8';
    const file = createFile({
      buffer: Buffer.from('0123456789'),
      size: 10,
    });

    await expect(service.storeAsset(file, 'user-1')).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('stores asset in IPFS when upload succeeds', async () => {
    const file = createFile();

    repository.findOne.mockResolvedValueOnce(null);
    ipfsService.upload.mockResolvedValueOnce({
      cid: 'bafy-ipfs-cid',
      uri: 'ipfs://bafy-ipfs-cid',
      gatewayUrl: 'https://provider.gateway/bafy-ipfs-cid',
    });
    repository.save.mockImplementation(async (entity) => ({
      id: 'asset-1',
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
      ...entity,
    }));

    const result = await service.storeAsset(file, 'user-1', { type: 'nft' });

    expect(result).toEqual({
      ipfs: {
        cid: 'bafy-ipfs-cid',
        uri: 'ipfs://bafy-ipfs-cid',
        gatewayUrl: 'https://ipfs.example/ipfs/bafy-ipfs-cid',
      },
      arweave: {
        id: null,
        uri: null,
        gatewayUrl: null,
      },
      primary: 'ipfs',
      size: file.size,
      mimeType: file.mimetype,
    });
    expect(ipfsService.upload).toHaveBeenCalledTimes(1);
    expect(arweaveService.upload).not.toHaveBeenCalled();
    expect(retryQueue.enqueue).not.toHaveBeenCalled();
  });

  it('falls back to Arweave when IPFS upload fails', async () => {
    const file = createFile();

    repository.findOne.mockResolvedValueOnce(null);
    ipfsService.upload.mockRejectedValueOnce(new Error('IPFS unavailable'));
    arweaveService.upload.mockResolvedValueOnce({
      id: 'arweave-tx-id',
      uri: 'ar://arweave-tx-id',
      gatewayUrl: 'https://provider.arweave/arweave-tx-id',
    });
    repository.save.mockImplementation(async (entity) => ({
      id: 'asset-2',
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
      ...entity,
    }));

    const result = await service.storeAsset(file, 'user-2');

    expect(result).toEqual({
      ipfs: {
        cid: null,
        uri: null,
        gatewayUrl: null,
      },
      arweave: {
        id: 'arweave-tx-id',
        uri: 'ar://arweave-tx-id',
        gatewayUrl: 'https://arweave.example/arweave-tx-id',
      },
      primary: 'arweave',
      size: file.size,
      mimeType: file.mimetype,
    });
    expect(retryQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ipfs',
      }),
    );
  });

  it('throws controlled error and enqueues retry when both providers fail', async () => {
    const file = createFile();

    repository.findOne.mockResolvedValueOnce(null);
    ipfsService.upload.mockRejectedValueOnce(new Error('IPFS failure'));
    arweaveService.upload.mockRejectedValueOnce(new Error('Arweave failure'));

    await expect(service.storeAsset(file, 'user-3')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    const retryProviders = retryQueue.enqueue.mock.calls.map(
      (call: [Record<string, unknown>]) => call[0].provider,
    );
    expect(retryProviders).toEqual(
      expect.arrayContaining(['ipfs', 'arweave', 'combined']),
    );
  });

  it('generates expected URIs and gateway URLs', () => {
    expect(toIpfsUri('bafy123')).toBe('ipfs://bafy123');
    expect(toArweaveUri('tx123')).toBe('ar://tx123');
    expect(toIpfsGatewayUrl('bafy123', 'https://ipfs.example/ipfs')).toBe(
      'https://ipfs.example/ipfs/bafy123',
    );
    expect(toArweaveGatewayUrl('tx123', 'https://arweave.example')).toBe(
      'https://arweave.example/tx123',
    );

    const ipfsPrimary: StoredAssetResult = {
      ipfs: {
        cid: 'bafy123',
        uri: 'ipfs://bafy123',
        gatewayUrl: 'https://ipfs.example/ipfs/bafy123',
      },
      arweave: {
        id: 'tx123',
        uri: 'ar://tx123',
        gatewayUrl: 'https://arweave.example/tx123',
      },
      primary: 'ipfs',
      size: 1,
      mimeType: 'image/png',
    };

    const arweavePrimary: StoredAssetResult = {
      ...ipfsPrimary,
      primary: 'arweave',
    };

    expect(toStellarMetadataUri(ipfsPrimary)).toBe('ipfs://bafy123');
    expect(toStellarMetadataUri(arweavePrimary)).toBe('ar://tx123');
  });
});
