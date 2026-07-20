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

// Types magic-byte detection cannot recognize (text-based/structured formats
// with no binary signature) — these skip the magic-byte cross-check but are
// still virus-scanned.
export const MIME_TYPES_WITHOUT_MAGIC_BYTES = new Set<string>([
  'image/svg+xml',
  'application/json',
]);

// Application-generated files that carry no user-controlled binary payload,
// so they're exempt from AV scanning but still pass MIME/size validation.
export const SCAN_EXEMPT_MIME_TYPES = new Set<string>(['application/json']);

// MIME types eligible for EXIF/metadata stripping via sharp.
export const EXIF_STRIPPABLE_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export const DEFAULT_MALWARE_SCAN_ENABLED = true;
export const DEFAULT_CLAMAV_HOST = '127.0.0.1';
export const DEFAULT_CLAMAV_PORT = 3310;
export const DEFAULT_SCAN_TIMEOUT_MS = 60_000;
export const DEFAULT_SCAN_RETRY_ATTEMPTS = 3;
export const DEFAULT_SCAN_RETRY_BACKOFF_MS = 500;
export const DEFAULT_SCAN_ASYNC_THRESHOLD_BYTES = 20 * 1024 * 1024;
export const DEFAULT_SCAN_FAIL_CLOSED = true;
export const DEFAULT_RESCAN_BATCH_SIZE = 25;
export const DEFAULT_RESCAN_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
