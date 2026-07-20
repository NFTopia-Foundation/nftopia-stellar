import { ConfigService } from '@nestjs/config';
import { ScanAlertService } from './scan-alert.service';

describe('ScanAlertService', () => {
  let service: ScanAlertService;
  let configValues: Record<string, string>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    configValues = {
      STORAGE_MALWARE_WEBHOOK_URL: 'https://example.com/webhook',
    };
    const configService = {
      get: (key: string) => configValues[key],
    } as unknown as ConfigService;

    service = new ScanAlertService(configService);

    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  it('posts a payload to the configured webhook URL', async () => {
    await service.notifyMalwareDetected({
      assetId: 'asset-1',
      fileHash: 'hash-1',
      uploadedBy: 'user-1',
      originalFilename: 'evil.png',
      scanResult: {
        status: 'infected',
        engine: 'clamav',
        viruses: ['Eicar-Test-Signature'],
        scannedAt: '2026-07-20T00:00:00.000Z',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(url).toBe('https://example.com/webhook');
    expect(JSON.parse(options.body)).toMatchObject({
      event: 'storage.malware_detected',
      assetId: 'asset-1',
    });
  });

  it('does nothing when no webhook URL is configured', async () => {
    configValues.STORAGE_MALWARE_WEBHOOK_URL = '';

    await service.notifyMalwareDetected({
      assetId: 'asset-1',
      fileHash: 'hash-1',
      uploadedBy: 'user-1',
      originalFilename: 'evil.png',
      scanResult: {
        status: 'infected',
        engine: 'clamav',
        viruses: [],
        scannedAt: '2026-07-20T00:00:00.000Z',
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows webhook delivery failures', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    await expect(
      service.notifyMalwareDetected({
        assetId: 'asset-1',
        fileHash: 'hash-1',
        uploadedBy: 'user-1',
        originalFilename: 'evil.png',
        scanResult: {
          status: 'infected',
          engine: 'clamav',
          viruses: [],
          scannedAt: '2026-07-20T00:00:00.000Z',
        },
      }),
    ).resolves.toBeUndefined();
  });
});
