import { ConfigService } from '@nestjs/config';
import { RescanJob } from './rescan.job';
import type { StoredAsset } from '../entities/stored-asset.entity';

describe('RescanJob', () => {
  let job: RescanJob;
  let repository: { find: jest.Mock; update: jest.Mock };
  let malwareScanner: { scan: jest.Mock };
  let scanAlert: { notifyMalwareDetected: jest.Mock };
  let configValues: Record<string, string>;
  let fetchMock: jest.Mock;

  const asset: Partial<StoredAsset> = {
    id: 'asset-1',
    fileHash: 'hash-1',
    ipfsCid: 'bafy123',
    arweaveId: null,
    uploadedBy: 'user-1',
    originalFilename: 'asset.png',
    scanStatus: 'clean',
    quarantined: false,
  };

  beforeEach(() => {
    configValues = {
      IPFS_GATEWAY_URL: 'https://ipfs.example/ipfs',
      ARWEAVE_GATEWAY_URL: 'https://arweave.example',
      SCAN_RESCAN_BATCH_SIZE: '10',
      SCAN_RESCAN_STALE_AFTER_MS: `${7 * 24 * 60 * 60 * 1000}`,
    };

    repository = {
      find: jest.fn().mockResolvedValue([asset]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    malwareScanner = { scan: jest.fn() };
    scanAlert = {
      notifyMalwareDetected: jest.fn().mockResolvedValue(undefined),
    };

    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('file-content').buffer),
    });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    const configService = {
      get: (key: string) => configValues[key],
    } as unknown as ConfigService;

    job = new RescanJob(
      repository as never,
      configService,
      malwareScanner as never,
      scanAlert as never,
    );
  });

  it('fetches and rescans stale clean assets', async () => {
    malwareScanner.scan.mockResolvedValueOnce({
      status: 'clean',
      engine: 'clamav',
      viruses: [],
      scannedAt: '2026-07-20T00:00:00.000Z',
    });

    const count = await job.rescanStaleAssets();

    expect(count).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith('https://ipfs.example/ipfs/bafy123');
    expect(repository.update).toHaveBeenCalledWith(
      'asset-1',
      expect.objectContaining({ scanStatus: 'clean', quarantined: false }),
    );
    expect(scanAlert.notifyMalwareDetected).not.toHaveBeenCalled();
  });

  it('quarantines and alerts when a rescan finds malware', async () => {
    malwareScanner.scan.mockResolvedValueOnce({
      status: 'infected',
      engine: 'clamav',
      viruses: ['Eicar-Test-Signature'],
      scannedAt: '2026-07-20T00:00:00.000Z',
    });

    await job.rescanStaleAssets();

    expect(repository.update).toHaveBeenCalledWith(
      'asset-1',
      expect.objectContaining({ scanStatus: 'infected', quarantined: true }),
    );
    expect(scanAlert.notifyMalwareDetected).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-1' }),
    );
  });

  it('skips rescanning entirely when malware scanning is disabled', async () => {
    configValues.MALWARE_SCAN_ENABLED = 'false';

    const count = await job.rescanStaleAssets();

    expect(count).toBe(0);
    expect(repository.find).not.toHaveBeenCalled();
  });
});
