export interface Wallet {
  publicKey: string;
  secretKey: string;
  mnemonic?: string;
}

export interface EncryptedWallet {
  data: string;
  iv: string;
  salt: string;
}

export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code: WalletErrorCode,
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export enum WalletErrorCode {
  INVALID_SECRET_KEY = 'INVALID_SECRET_KEY',
  INVALID_MNEMONIC = 'INVALID_MNEMONIC',
  STORAGE_ERROR = 'STORAGE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  SIGN_ERROR = 'SIGN_ERROR',
}
