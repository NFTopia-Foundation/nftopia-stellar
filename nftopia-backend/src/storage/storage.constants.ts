import type { IpfsProvider } from './storage.types';

export const STORAGE_RETRY_QUEUE = 'STORAGE_RETRY_QUEUE';

export const DEFAULT_IPFS_PROVIDER: IpfsProvider = 'pinata';
export const DEFAULT_IPFS_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_ARWEAVE_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const DEFAULT_IPFS_GATEWAY_URL = 'https://ipfs.io/ipfs';
export const DEFAULT_ARWEAVE_GATEWAY_URL = 'https://arweave.net';
export const DEFAULT_FALLBACK_ENABLED = true;

export const DEFAULT_IPFS_RETRY_ATTEMPTS = 2;
export const DEFAULT_IPFS_RETRY_BACKOFF_MS = 250;
export const DEFAULT_ARWEAVE_RETRY_ATTEMPTS = 2;
export const DEFAULT_ARWEAVE_RETRY_BACKOFF_MS = 350;

export const ALLOWED_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'application/json',
]);
