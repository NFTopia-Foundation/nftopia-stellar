import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_ARWEAVE_GATEWAY_URL,
  DEFAULT_ARWEAVE_MAX_FILE_SIZE_BYTES,
  DEFAULT_ARWEAVE_RETRY_ATTEMPTS,
  DEFAULT_ARWEAVE_RETRY_BACKOFF_MS,
  DEFAULT_CLAMAV_HOST,
  DEFAULT_CLAMAV_PORT,
  DEFAULT_FALLBACK_ENABLED,
  DEFAULT_IPFS_GATEWAY_URL,
  DEFAULT_IPFS_MAX_FILE_SIZE_BYTES,
  DEFAULT_IPFS_PROVIDER,
  DEFAULT_IPFS_RETRY_ATTEMPTS,
  DEFAULT_IPFS_RETRY_BACKOFF_MS,
  DEFAULT_MALWARE_SCAN_ENABLED,
  DEFAULT_RESCAN_BATCH_SIZE,
  DEFAULT_RESCAN_STALE_AFTER_MS,
  DEFAULT_SCAN_ASYNC_THRESHOLD_BYTES,
  DEFAULT_SCAN_FAIL_CLOSED,
  DEFAULT_SCAN_RETRY_ATTEMPTS,
  DEFAULT_SCAN_RETRY_BACKOFF_MS,
  DEFAULT_SCAN_TIMEOUT_MS,
} from './storage.constants';
import type { IpfsProvider, StorageConfig } from './storage.types';

const toNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const toBoolean = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (!value) {
    return defaultValue;
  }

  return value.trim().toLowerCase() === 'true';
};

const toIpfsProvider = (value: string | undefined): IpfsProvider => {
  if (!value) {
    return DEFAULT_IPFS_PROVIDER;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'pinata' ||
    normalized === 'web3storage' ||
    normalized === 'nftstorage'
  ) {
    return normalized;
  }

  return DEFAULT_IPFS_PROVIDER;
};

export const getStorageConfig = (
  configService: ConfigService,
): StorageConfig => ({
  fallbackEnabled: toBoolean(
    configService.get<string>('STORAGE_FALLBACK_ENABLED'),
    DEFAULT_FALLBACK_ENABLED,
  ),
  ipfs: {
    provider: toIpfsProvider(configService.get<string>('IPFS_PROVIDER')),
    maxFileSizeBytes: toNumber(
      configService.get<string>('IPFS_MAX_FILE_SIZE_BYTES'),
      DEFAULT_IPFS_MAX_FILE_SIZE_BYTES,
    ),
    gatewayUrl:
      configService.get<string>('IPFS_GATEWAY_URL') || DEFAULT_IPFS_GATEWAY_URL,
    retryAttempts: toNumber(
      configService.get<string>('IPFS_RETRY_ATTEMPTS'),
      DEFAULT_IPFS_RETRY_ATTEMPTS,
    ),
    retryBackoffMs: toNumber(
      configService.get<string>('IPFS_RETRY_BACKOFF_MS'),
      DEFAULT_IPFS_RETRY_BACKOFF_MS,
    ),
    pinataJwt: configService.get<string>('IPFS_PINATA_JWT'),
    web3StorageToken: configService.get<string>('IPFS_WEB3STORAGE_TOKEN'),
    nftStorageToken: configService.get<string>('IPFS_NFTSTORAGE_TOKEN'),
  },
  arweave: {
    maxFileSizeBytes: toNumber(
      configService.get<string>('ARWEAVE_MAX_FILE_SIZE_BYTES'),
      DEFAULT_ARWEAVE_MAX_FILE_SIZE_BYTES,
    ),
    gatewayUrl:
      configService.get<string>('ARWEAVE_GATEWAY_URL') ||
      DEFAULT_ARWEAVE_GATEWAY_URL,
    host: configService.get<string>('ARWEAVE_HOST') || 'arweave.net',
    port: toNumber(configService.get<string>('ARWEAVE_PORT'), 443),
    protocol:
      configService.get<string>('ARWEAVE_PROTOCOL') === 'http'
        ? 'http'
        : 'https',
    walletPath: configService.get<string>('ARWEAVE_WALLET_PATH'),
    walletJwk: configService.get<string>('ARWEAVE_WALLET_JWK'),
    retryAttempts: toNumber(
      configService.get<string>('ARWEAVE_RETRY_ATTEMPTS'),
      DEFAULT_ARWEAVE_RETRY_ATTEMPTS,
    ),
    retryBackoffMs: toNumber(
      configService.get<string>('ARWEAVE_RETRY_BACKOFF_MS'),
      DEFAULT_ARWEAVE_RETRY_BACKOFF_MS,
    ),
  },
  scanning: {
    enabled: toBoolean(
      configService.get<string>('MALWARE_SCAN_ENABLED'),
      DEFAULT_MALWARE_SCAN_ENABLED,
    ),
    clamavHost: configService.get<string>('CLAMAV_HOST') || DEFAULT_CLAMAV_HOST,
    clamavPort: toNumber(
      configService.get<string>('CLAMAV_PORT'),
      DEFAULT_CLAMAV_PORT,
    ),
    timeoutMs: toNumber(
      configService.get<string>('SCAN_TIMEOUT_MS'),
      DEFAULT_SCAN_TIMEOUT_MS,
    ),
    retryAttempts: toNumber(
      configService.get<string>('SCAN_RETRY_ATTEMPTS'),
      DEFAULT_SCAN_RETRY_ATTEMPTS,
    ),
    retryBackoffMs: toNumber(
      configService.get<string>('SCAN_RETRY_BACKOFF_MS'),
      DEFAULT_SCAN_RETRY_BACKOFF_MS,
    ),
    asyncThresholdBytes: toNumber(
      configService.get<string>('SCAN_ASYNC_THRESHOLD_BYTES'),
      DEFAULT_SCAN_ASYNC_THRESHOLD_BYTES,
    ),
    failClosed: toBoolean(
      configService.get<string>('SCAN_FAIL_CLOSED'),
      DEFAULT_SCAN_FAIL_CLOSED,
    ),
    webhookUrl: configService.get<string>('STORAGE_MALWARE_WEBHOOK_URL'),
    rescanBatchSize: toNumber(
      configService.get<string>('SCAN_RESCAN_BATCH_SIZE'),
      DEFAULT_RESCAN_BATCH_SIZE,
    ),
    rescanStaleAfterMs: toNumber(
      configService.get<string>('SCAN_RESCAN_STALE_AFTER_MS'),
      DEFAULT_RESCAN_STALE_AFTER_MS,
    ),
  },
});
