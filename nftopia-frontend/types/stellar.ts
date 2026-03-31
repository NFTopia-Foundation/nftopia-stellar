export type StellarNetwork = "testnet" | "mainnet";

export type WalletProvider = "freighter" | "albedo" | "walletconnect" | "lobstr";

export interface StellarWalletState {
  address: string | null;
  provider: WalletProvider | null;
  network: StellarNetwork;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export interface WalletAuthChallenge {
  nonce: string;
  expiresAt: number;
}

export interface WalletAuthPayload {
  publicKey: string;
  signature: string;
  nonce: string;
  provider: WalletProvider;
}

export interface StellarBalance {
  asset: string;
  balance: string;
  assetCode?: string;
  assetIssuer?: string;
}

export interface StellarTransaction {
  xdr: string;
  network: StellarNetwork;
}

export interface SignedTransaction {
  signedXdr: string;
}

export interface WalletInfo {
  id: WalletProvider;
  name: string;
  logo: string;
  description: string;
  installUrl: string;
  available: boolean;
}