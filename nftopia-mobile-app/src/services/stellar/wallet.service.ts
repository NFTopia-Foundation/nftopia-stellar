/**
 * StellarWalletService stub — full implementation tracked in Issue #112.
 *
 * This interface matches the spec in Issue #112 and is consumed by the
 * wallet creation/import screens (Issue #117). Replace with the real
 * implementation once Issue #112 is merged.
 */

import { Wallet, WalletCreateResult } from './types';

export class StellarWalletService {
  async createWallet(_password?: string): Promise<WalletCreateResult> {
    throw new Error('StellarWalletService.createWallet not yet implemented (Issue #112)');
  }

  async importFromSecretKey(_secretKey: string, _password?: string): Promise<Wallet> {
    throw new Error('StellarWalletService.importFromSecretKey not yet implemented (Issue #112)');
  }

  async importFromMnemonic(_mnemonic: string, _password?: string): Promise<Wallet> {
    throw new Error('StellarWalletService.importFromMnemonic not yet implemented (Issue #112)');
  }

  async signMessage(_message: string, _secretKey: string): Promise<string> {
    throw new Error('StellarWalletService.signMessage not yet implemented (Issue #112)');
  }

  getPublicKey(_secretKey: string): string {
    throw new Error('StellarWalletService.getPublicKey not yet implemented (Issue #112)');
  }

  isValidSecretKey(key: string): boolean {
    // Stellar secret keys start with 'S' and are 56 characters
    return /^S[A-Z2-7]{55}$/.test(key.trim());
  }

  isValidMnemonic(phrase: string): boolean {
    const words = phrase.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
  }
}

export const stellarWalletService = new StellarWalletService();
