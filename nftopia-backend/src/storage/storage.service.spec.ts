import {
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArweaveService } from './arweave.service';
import { StoredAsset } from './entities/stored-asset.entity';
import { IpfsService } from './ipfs.service';
import type { RetryQueue } from './interfaces/retry-queue.interface';
import { FileInspectorService } from './scanning/file-inspector.service';
import { MalwareScannerService } from './scanning/malware-scanner.service';
import { ScanAlertService } from './scanning/scan-alert.service';
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

const createFile = (overrides: Partial<UploadedFile> = {}): UploadedFile => {
  const buffer = overrides.buffer ?? Buffer.from('nftopia-storage-file');

  return {
    originalname: 'asset.png',
    mimetype: 'image/png',
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
    update: jest.Mock;
  };
  let ipfsService: { upload: jest.Mock };
  let arweaveService: { upload: jest.Mock };
  let retryQueue: RetryQueue & { enqueue: jest.Mock };
  let fileInspector: { detectMimeType: jest.Mock; sanitize: jest.Mock };
  let malwareScanner: { scan: jest.Mock };
  let scanAlert: { notifyMalwareDetected: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
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
      SCAN_ASYNC_THRESHOLD_BYTES: `${20 * 1024 * 1024}`,
    };

    repository = {
      findOne: jest.fn(),
      create: jest.fn((input: Partial<StoredAsset>) => input as StoredAsset),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
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

    fileInspector = {
      detectMimeType: jest.fn((_buffer: Buffer, mimetype: string) => mimetype),
      sanitize: jest.fn((buffer: Buffer) => Promise.resolve(buffer)),
    };

    malwareScanner = {
      scan: jest.fn().mockResolvedValue({
        status: 'clean',
        engine: 'clamav',
        viruses: [],
        scannedAt: '2026-07-20T00:00:00.000Z',
      }),
    };

    scanAlert = {
      notifyMalwareDetected: jest.fn().mockResolvedValue(undefined),
    };

    eventEmitter = { emit: jest.fn() };

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
        {
          provide: FileInspectorService,
          useValue: fileInspector,
        },
        {
          provide: MalwareScannerService,
          useValue: malwareScanner,
        },
        {
          provide: ScanAlertService,
          useValue: scanAlert,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
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

  it('rejects files whose content does not match the declared MIME type', async () => {
    fileInspector.detectMimeType.mockReturnValueOnce(null);
    const file = createFile();

    await expect(service.storeAsset(file, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ipfsService.upload).not.toHaveBeenCalled();
  });

  it('stores asset in IPFS when upload succeeds', async () => {
    const file = createFile();

    repository.findOne.mockResolvedValueOnce(null);
    ipfsService.upload.mockResolvedValueOnce({
      cid: 'bafy-ipfs-cid',
      uri: 'ipfs://bafy-ipfs-cid',
      gatewayUrl: 'https://provider.gateway/bafy-ipfs-cid',
    });
    repository.save.mockImplementation((entity: StoredAsset) =>
      Promise.resolve({
        ...entity,
        id: 'asset-1',
        createdAt: new Date('2026-02-20T00:00:00.000Z'),
        updatedAt: new Date('2026-02-20T00:00:00.000Z'),
      }),
    );

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
    expect(malwareScanner.scan).toHaveBeenCalledTimes(1);
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
    repository.save.mockImplementation((entity: StoredAsset) =>
      Promise.resolve({
        ...entity,
        id: 'asset-2',
        createdAt: new Date('2026-02-20T00:00:00.000Z'),
        updatedAt: new Date('2026-02-20T00:00:00.000Z'),
      }),
    );

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

  it('quarantines infected files instead of uploading them', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    malwareScanner.scan.mockResolvedValueOnce({
      status: 'infected',
      engine: 'clamav',
      viruses: ['Eicar-Test-Signature'],
      scannedAt: '2026-07-20T00:00:00.000Z',
    });
    repository.save.mockImplementation((entity: StoredAsset) =>
      Promise.resolve({ ...entity, id: 'asset-quarantined' }),
    );

    const file = createFile();

    await expect(service.storeAsset(file, 'user-4')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(ipfsService.upload).not.toHaveBeenCalled();
    expect(arweaveService.upload).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ quarantined: true, scanStatus: 'infected' }),
    );
    expect(scanAlert.notifyMalwareDetected).toHaveBeenCalledTimes(1);
  });

  it('blocks upload when scanning fails and fail-closed is enabled', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    malwareScanner.scan.mockResolvedValueOnce({
      status: 'failed',
      engine: 'clamav',
      viruses: [],
      scannedAt: '2026-07-20T00:00:00.000Z',
      error: 'clamd unreachable',
    });

    const file = createFile();

    await expect(service.storeAsset(file, 'user-5')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(ipfsService.upload).not.toHaveBeenCalled();
  });

  it('queues large files for async scanning instead of scanning inline', async () => {
    configValues.SCAN_ASYNC_THRESHOLD_BYTES = '5';
    repository.findOne.mockResolvedValueOnce(null);
    repository.save.mockImplementation((entity: StoredAsset) =>
      Promise.resolve({ ...entity, id: 'asset-pending' }),
    );

    const file = createFile({ buffer: Buffer.from('this-is-a-big-file') });

    const result = await service.storeAsset(file, 'user-6');

    expect(malwareScanner.scan).not.toHaveBeenCalled();
    expect(ipfsService.upload).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'storage.scan.pending',
      expect.objectContaining({ assetId: 'asset-pending' }),
    );
    expect(result.ipfs.cid).toBeNull();
    expect(result.arweave.id).toBeNull();
  });

  it('uploads a pending asset once its async scan comes back clean', async () => {
    ipfsService.upload.mockResolvedValueOnce({
      cid: 'bafy-async',
      uri: 'ipfs://bafy-async',
      gatewayUrl: 'https://provider.gateway/bafy-async',
    });

    await service.handlePendingScan({
      assetId: 'asset-pending',
      file: createFile(),
      fileHash: 'hash-pending',
      uploadedBy: 'user-6',
      metadata: undefined,
      ipfsEligible: true,
    });

    expect(malwareScanner.scan).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(
      'asset-pending',
      expect.objectContaining({
        ipfsCid: 'bafy-async',
        primaryStorage: 'ipfs',
        scanStatus: 'clean',
      }),
    );
  });

  it('quarantines a pending asset once its async scan finds malware', async () => {
    malwareScanner.scan.mockResolvedValueOnce({
      status: 'infected',
      engine: 'clamav',
      viruses: ['Eicar-Test-Signature'],
      scannedAt: '2026-07-20T00:00:00.000Z',
    });

    await service.handlePendingScan({
      assetId: 'asset-pending',
      file: createFile(),
      fileHash: 'hash-pending',
      uploadedBy: 'user-6',
      metadata: undefined,
      ipfsEligible: true,
    });

    expect(ipfsService.upload).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      'asset-pending',
      expect.objectContaining({ quarantined: true, scanStatus: 'infected' }),
    );
    expect(scanAlert.notifyMalwareDetected).toHaveBeenCalledTimes(1);
  });

  it('rejects re-uploading a file already flagged as quarantined', async () => {
    repository.findOne.mockResolvedValueOnce({
      quarantined: true,
      fileHash: 'existing-hash',
    });

    const file = createFile();

    await expect(service.storeAsset(file, 'user-7')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(malwareScanner.scan).not.toHaveBeenCalled();
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
