import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getStorageConfig } from './storage.config';
import type {
  IpfsProvider,
  IpfsUploadResult,
  UploadedFile,
} from './storage.types';
import { toIpfsGatewayUrl, toIpfsUri } from './utils/uri.utils';

interface PinataUploadResponse {
  IpfsHash?: string;
}

@Injectable()
export class IpfsService {
  constructor(private readonly configService: ConfigService) {}

  async upload(file: UploadedFile): Promise<IpfsUploadResult> {
    const ipfsConfig = getStorageConfig(this.configService).ipfs;

    switch (ipfsConfig.provider) {
      case 'pinata':
        return this.uploadWithPinata(file);
      case 'web3storage':
        return this.uploadWithStorageApi(file, 'web3storage');
      case 'nftstorage':
        return this.uploadWithStorageApi(file, 'nftstorage');
      default: {
        const unsupportedProvider: unknown = ipfsConfig.provider;
        throw new Error(
          `Unsupported IPFS provider: ${String(unsupportedProvider)}`,
        );
      }
    }
  }

  private async uploadWithPinata(
    file: UploadedFile,
  ): Promise<IpfsUploadResult> {
    const ipfsConfig = getStorageConfig(this.configService).ipfs;
    const fileBytes = Uint8Array.from(file.buffer);

    if (!ipfsConfig.pinataJwt) {
      throw new Error('IPFS_PINATA_JWT is not configured');
    }

    const formData = new FormData();
    formData.append(
      'file',
      new Blob([fileBytes], { type: file.mimetype }),
      file.originalname,
    );
    formData.append(
      'pinataMetadata',
      JSON.stringify({ name: file.originalname }),
    );

    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ipfsConfig.pinataJwt}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Pinata upload failed (${response.status}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as PinataUploadResponse;
    const cid = payload.IpfsHash;

    if (!cid) {
      throw new Error('Pinata upload response did not contain IpfsHash');
    }

    return {
      cid,
      uri: toIpfsUri(cid),
      gatewayUrl: toIpfsGatewayUrl(cid, ipfsConfig.gatewayUrl),
    };
  }

  private async uploadWithStorageApi(
    file: UploadedFile,
    provider: Extract<IpfsProvider, 'web3storage' | 'nftstorage'>,
  ): Promise<IpfsUploadResult> {
    const ipfsConfig = getStorageConfig(this.configService).ipfs;
    const fileBytes = Uint8Array.from(file.buffer);

    const token =
      provider === 'web3storage'
        ? ipfsConfig.web3StorageToken
        : ipfsConfig.nftStorageToken;

    if (!token) {
      throw new Error(
        provider === 'web3storage'
          ? 'IPFS_WEB3STORAGE_TOKEN is not configured'
          : 'IPFS_NFTSTORAGE_TOKEN is not configured',
      );
    }

    const endpoint =
      provider === 'web3storage'
        ? 'https://api.web3.storage/upload'
        : 'https://api.nft.storage/upload';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.mimetype,
      },
      body: fileBytes,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `${provider} upload failed (${response.status}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const cid = this.extractCid(payload);

    if (!cid) {
      throw new Error(`${provider} upload response did not include a CID`);
    }

    return {
      cid,
      uri: toIpfsUri(cid),
      gatewayUrl: toIpfsGatewayUrl(cid, ipfsConfig.gatewayUrl),
    };
  }

  private extractCid(payload: Record<string, unknown>): string | null {
    const fromIpfsHash = payload.IpfsHash;
    if (typeof fromIpfsHash === 'string') {
      return fromIpfsHash;
    }

    const value = payload.value as Record<string, unknown> | undefined;
    if (value) {
      const valueCid = value.cid;
      const parsedValueCid = this.parseCidLike(valueCid);
      if (parsedValueCid) {
        return parsedValueCid;
      }
    }

    const cid = this.parseCidLike(payload.cid);
    if (cid) {
      return cid;
    }

    return null;
  }

  private parseCidLike(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    const asRecord = value as Record<string, unknown>;

    const slashValue = asRecord['/'];
    if (typeof slashValue === 'string') {
      return slashValue;
    }

    return null;
  }
}
