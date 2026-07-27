import { Horizon } from 'stellar-sdk';
import { NetworkType } from '@/stores/walletStore';

export const HORIZON_MAINNET = 'https://horizon.stellar.org';
export const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE_MAINNET = 'Public Global Stellar Network ; September 2015';
export const NETWORK_PASSPHRASE_TESTNET = 'Test SDF Network ; September 2015';

export function getHorizonUrl(network: NetworkType): string {
  return network === 'mainnet' ? HORIZON_MAINNET : HORIZON_TESTNET;
}

export function getNetworkPassphrase(network: NetworkType): string {
  return network === 'mainnet' ? NETWORK_PASSPHRASE_MAINNET : NETWORK_PASSPHRASE_TESTNET;
}

export function createServer(network: NetworkType): Horizon.Server {
  return new Horizon.Server(getHorizonUrl(network));
}
