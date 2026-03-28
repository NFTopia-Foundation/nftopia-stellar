import { Keypair } from 'stellar-sdk';
import StellarHDWallet from 'stellar-hd-wallet';
import { Wallet, WalletError, WalletErrorCode } from './types';
import {
  isValidSecretKey,
  isValidMnemonic,
  assertValidSecretKey,
  assertValidMnemonic,
} from './validation';
import { SecureStorage } from './secureStorage';

export class StellarWalletService {
  private readonly storage: SecureStorage;

  constructor(storage?: SecureStorage) {
    this.storage = storage ?? new SecureStorage();
  }

  async createWallet(password?: string): Promise<Wallet> {
    const keypair = Keypair.random();
    const wallet: Wallet = {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
    await this.storage.saveWallet(wallet, password);
    return wallet;
  }

  async importFromSecretKey(secretKey: string, password?: string): Promise<Wallet> {
    assertValidSecretKey(secretKey);
    const keypair = Keypair.fromSecret(secretKey);
    const wallet: Wallet = {
      publicKey: keypair.publicKey(),
      secretKey,
    };
    await this.storage.saveWallet(wallet, password);
    return wallet;
  }

  async importFromMnemonic(mnemonic: string, password?: string): Promise<Wallet> {
    assertValidMnemonic(mnemonic);
    try {
      const hdWallet = StellarHDWallet.fromMnemonic(mnemonic);
      const keypair = hdWallet.getKeypair(0);
      const wallet: Wallet = {
        publicKey: keypair.publicKey(),
        secretKey: keypair.secret(),
        mnemonic,
      };
      await this.storage.saveWallet(wallet, password);
      return wallet;
    } catch (err) {
      if (err instanceof WalletError) throw err;
      throw new WalletError(
        `Failed to derive wallet from mnemonic: ${(err as Error).message}`,
        WalletErrorCode.INVALID_MNEMONIC,
      );
    }
  }

  async signMessage(message: string, secretKey: string): Promise<string> {
    assertValidSecretKey(secretKey);
    try {
      const keypair = Keypair.fromSecret(secretKey);
      const messageBuffer = Buffer.from(message, 'utf-8');
      const signature = keypair.sign(messageBuffer);
      return Buffer.from(signature).toString('base64');
    } catch (err) {
      if (err instanceof WalletError) throw err;
      throw new WalletError(
        `Failed to sign message: ${(err as Error).message}`,
        WalletErrorCode.SIGN_ERROR,
      );
    }
  }

  getPublicKey(secretKey: string): string {
    assertValidSecretKey(secretKey);
    return Keypair.fromSecret(secretKey).publicKey();
  }

  isValidSecretKey(key: string): boolean {
    return isValidSecretKey(key);
  }

  isValidMnemonic(phrase: string): boolean {
    return isValidMnemonic(phrase);
  }
}
