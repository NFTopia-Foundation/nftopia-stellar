export type IpfsProvider = 'pinata' | 'web3storage' | 'nftstorage';

export type PrimaryStorage = 'ipfs' | 'arweave';

export type RetryProvider = PrimaryStorage | 'combined';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface IpfsAssetLocation {
  cid: string | null;
  uri: string | null;
  gatewayUrl: string | null;
}

export interface ArweaveAssetLocation {
  id: string | null;
  uri: string | null;
  gatewayUrl: string | null;
}

export interface StoredAssetResult {
  ipfs: IpfsAssetLocation;
  arweave: ArweaveAssetLocation;
  primary: PrimaryStorage;
  size: number;
  mimeType: string;
}

export interface IpfsUploadResult {
  cid: string;
  uri: string;
  gatewayUrl: string;
}

export interface ArweaveUploadResult {
  id: string;
  uri: string;
  gatewayUrl: string;
}

export interface StorageConfig {
  fallbackEnabled: boolean;
  ipfs: {
    provider: IpfsProvider;
    maxFileSizeBytes: number;
    gatewayUrl: string;
    retryAttempts: number;
    retryBackoffMs: number;
    pinataJwt?: string;
    web3StorageToken?: string;
    nftStorageToken?: string;
  };
  arweave: {
    maxFileSizeBytes: number;
    gatewayUrl: string;
    host: string;
    port: number;
    protocol: 'http' | 'https';
    walletPath?: string;
    walletJwk?: string;
    retryAttempts: number;
    retryBackoffMs: number;
  };
}

export interface RetryQueueEntry {
  provider: RetryProvider;
  fileHash: string;
  uploadedBy: string;
  mimeType: string;
  size: number;
  errorMessage: string;
  metadata?: Record<string, unknown>;
  attempt: number;
  queuedAt?: string;
}
