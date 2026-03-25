export interface Wallet {
  publicKey: string;
  secretKey: string;
  mnemonic?: string;
}

export interface WalletCreateResult {
  wallet: Wallet;
  mnemonic: string;
}
