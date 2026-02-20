import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_ARWEAVE_GATEWAY_URL,
  DEFAULT_ARWEAVE_MAX_FILE_SIZE_BYTES,
  DEFAULT_ARWEAVE_RETRY_ATTEMPTS,
  DEFAULT_ARWEAVE_RETRY_BACKOFF_MS,
  DEFAULT_FALLBACK_ENABLED,
  DEFAULT_IPFS_GATEWAY_URL,
  DEFAULT_IPFS_MAX_FILE_SIZE_BYTES,
  DEFAULT_IPFS_PROVIDER,
  DEFAULT_IPFS_RETRY_ATTEMPTS,
  DEFAULT_IPFS_RETRY_BACKOFF_MS,
} from './storage.constants';
import type { IpfsProvider, StorageConfig } from './storage.types';

const toNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const toBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
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

export const getStorageConfig = (configService: ConfigService): StorageConfig => ({
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
});
