import { Keypair } from 'stellar-sdk';
import * as bip39 from 'bip39';
import { Wallet, WalletCreateResult, WalletError, WalletErrorCode } from './types';
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

  async createWallet(password?: string): Promise<WalletCreateResult> {
    const mnemonic = bip39.generateMnemonic();
    // Derive seed from mnemonic
    const seed = await bip39.mnemonicToSeed(mnemonic);
    // Use first 32 bytes of seed for Stellar keypair
    const rawSeed = seed.slice(0, 32);
    const keypair = Keypair.fromRawEd25519Seed(rawSeed);
    const wallet: Wallet = {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
      mnemonic,
    };
    await this.storage.saveWallet(wallet, password);
    return { wallet, mnemonic };
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
      // Validate mnemonic
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new WalletError('Invalid mnemonic', WalletErrorCode.INVALID_MNEMONIC);
      }
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const rawSeed = seed.slice(0, 32);
      const keypair = Keypair.fromRawEd25519Seed(rawSeed);
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

export const stellarWalletService = new StellarWalletService();
