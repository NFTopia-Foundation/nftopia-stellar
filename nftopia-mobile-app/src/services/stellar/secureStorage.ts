import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Wallet, EncryptedWallet, WalletError, WalletErrorCode } from './types';

const WALLET_KEY = 'nftopia_wallet';

export class SecureStorage {
  async saveWallet(wallet: Wallet, password?: string): Promise<void> {
    try {
      let payload: string;
      if (password) {
        payload = await this._encrypt(JSON.stringify(wallet), password);
      } else {
        payload = JSON.stringify(wallet);
      }
      await SecureStore.setItemAsync(WALLET_KEY, payload);
    } catch (err) {
      if (err instanceof WalletError) throw err;
      throw new WalletError(
        `Failed to save wallet: ${(err as Error).message}`,
        WalletErrorCode.STORAGE_ERROR,
      );
    }
  }

  async getWallet(password?: string): Promise<Wallet | null> {
    try {
      const payload = await SecureStore.getItemAsync(WALLET_KEY);
      if (!payload) return null;

      if (password) {
        const decrypted = await this._decrypt(payload, password);
        return JSON.parse(decrypted) as Wallet;
      }
      return JSON.parse(payload) as Wallet;
    } catch (err) {
      if (err instanceof WalletError) throw err;
      throw new WalletError(
        `Failed to retrieve wallet: ${(err as Error).message}`,
        WalletErrorCode.STORAGE_ERROR,
      );
    }
  }

  async deleteWallet(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(WALLET_KEY);
    } catch (err) {
      throw new WalletError(
        `Failed to delete wallet: ${(err as Error).message}`,
        WalletErrorCode.STORAGE_ERROR,
      );
    }
  }

  async hasWallet(): Promise<boolean> {
    try {
      const item = await SecureStore.getItemAsync(WALLET_KEY);
      return item !== null;
    } catch {
      return false;
    }
  }

  private async _encrypt(plaintext: string, password: string): Promise<string> {
    try {
      const salt = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password + Date.now().toString(),
      );
      // Simple XOR-based encryption using a derived key from password+salt.
      // NOTE: For production, replace with a proper AES library (e.g. expo-crypto AES or react-native-aes-crypto).
      const key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password + salt,
      );
      const iv = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        key,
      );
      const encrypted = this._xorEncrypt(plaintext, key);
      const result: EncryptedWallet = { data: encrypted, iv, salt };
      return JSON.stringify(result);
    } catch (err) {
      throw new WalletError(
        `Encryption failed: ${(err as Error).message}`,
        WalletErrorCode.ENCRYPTION_ERROR,
      );
    }
  }

  private async _decrypt(ciphertext: string, password: string): Promise<string> {
    try {
      const { data, salt }: EncryptedWallet = JSON.parse(ciphertext);
      const key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password + salt,
      );
      return this._xorEncrypt(data, key);
    } catch (err) {
      if (err instanceof WalletError) throw err;
      throw new WalletError(
        `Decryption failed: ${(err as Error).message}`,
        WalletErrorCode.ENCRYPTION_ERROR,
      );
    }
  }

  private _xorEncrypt(text: string, key: string): string {
    return text
      .split('')
      .map((char, i) =>
        String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)),
      )
      .join('');
  }
}
