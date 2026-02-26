import type { StoredAssetResult } from '../storage.types';

const normalizeGatewayBase = (gatewayBase: string): string => {
  const trimmed = gatewayBase.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const toIpfsUri = (cid: string): string => `ipfs://${cid}`;

export const toArweaveUri = (id: string): string => `ar://${id}`;

export const toIpfsGatewayUrl = (cid: string, gatewayBase: string): string =>
  `${normalizeGatewayBase(gatewayBase)}/${cid}`;

export const toArweaveGatewayUrl = (id: string, gatewayBase: string): string =>
  `${normalizeGatewayBase(gatewayBase)}/${id}`;

/**
 * Soroban NFT metadata should store decentralized content URIs in `ipfs://{cid}` or `ar://{id}` format.
 */
export const toStellarMetadataUri = (
  providerResult: Pick<StoredAssetResult, 'primary' | 'ipfs' | 'arweave'>,
): string => {
  if (providerResult.primary === 'ipfs' && providerResult.ipfs.uri) {
    return providerResult.ipfs.uri;
  }

  if (providerResult.primary === 'arweave' && providerResult.arweave.uri) {
    return providerResult.arweave.uri;
  }

  if (providerResult.ipfs.uri) {
    return providerResult.ipfs.uri;
  }

  if (providerResult.arweave.uri) {
    return providerResult.arweave.uri;
  }

  throw new Error('No decentralized URI available');
};
