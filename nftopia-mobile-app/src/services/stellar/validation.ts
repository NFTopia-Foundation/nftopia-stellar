import { Keypair } from 'stellar-sdk';
import { WalletError, WalletErrorCode } from './types';

const MNEMONIC_WORD_COUNTS = [12, 15, 18, 21, 24];

export function isValidSecretKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  try {
    const keypair = Keypair.fromSecret(key);
    return keypair.publicKey().length > 0;
  } catch {
    return false;
  }
}

export function isValidMnemonic(phrase: string): boolean {
  if (!phrase || typeof phrase !== 'string') return false;
  const words = phrase.trim().split(/\s+/);
  return MNEMONIC_WORD_COUNTS.includes(words.length);
}

export function assertValidSecretKey(key: string): void {
  if (!isValidSecretKey(key)) {
    throw new WalletError(
      'Invalid Stellar secret key format',
      WalletErrorCode.INVALID_SECRET_KEY,
    );
  }
}

export function assertValidMnemonic(phrase: string): void {
  if (!isValidMnemonic(phrase)) {
    throw new WalletError(
      `Invalid mnemonic phrase. Must contain ${MNEMONIC_WORD_COUNTS.join(', ')} words`,
      WalletErrorCode.INVALID_MNEMONIC,
    );
  }
}
