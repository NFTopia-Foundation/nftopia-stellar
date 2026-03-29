import { Keypair } from 'stellar-sdk';
import { isValidSecretKey, isValidMnemonic, assertValidSecretKey, assertValidMnemonic } from '../validation';
import { WalletError, WalletErrorCode } from '../types';

const VALID_SECRET_KEY = Keypair.random().secret();
const VALID_MNEMONIC_12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const VALID_MNEMONIC_24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

describe('isValidSecretKey', () => {
  it('returns true for a valid Stellar secret key', () => {
    expect(isValidSecretKey(VALID_SECRET_KEY)).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidSecretKey('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isValidSecretKey('not-a-key')).toBe(false);
  });

  it('returns false for a public key', () => {
    const publicKey = Keypair.random().publicKey();
    expect(isValidSecretKey(publicKey)).toBe(false);
  });
});

describe('isValidMnemonic', () => {
  it('returns true for a valid 12-word mnemonic', () => {
    expect(isValidMnemonic(VALID_MNEMONIC_12)).toBe(true);
  });

  it('returns true for a valid 24-word mnemonic', () => {
    expect(isValidMnemonic(VALID_MNEMONIC_24)).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidMnemonic('')).toBe(false);
  });

  it('returns false for a phrase with wrong word count', () => {
    expect(isValidMnemonic('one two three')).toBe(false);
  });
});

describe('assertValidSecretKey', () => {
  it('does not throw for a valid key', () => {
    expect(() => assertValidSecretKey(VALID_SECRET_KEY)).not.toThrow();
  });

  it('throws WalletError with INVALID_SECRET_KEY for invalid key', () => {
    expect(() => assertValidSecretKey('bad-key')).toThrow(WalletError);
    try {
      assertValidSecretKey('bad-key');
    } catch (err) {
      expect((err as WalletError).code).toBe(WalletErrorCode.INVALID_SECRET_KEY);
    }
  });
});

describe('assertValidMnemonic', () => {
  it('does not throw for a valid mnemonic', () => {
    expect(() => assertValidMnemonic(VALID_MNEMONIC_12)).not.toThrow();
  });

  it('throws WalletError with INVALID_MNEMONIC for invalid phrase', () => {
    expect(() => assertValidMnemonic('too short')).toThrow(WalletError);
    try {
      assertValidMnemonic('too short');
    } catch (err) {
      expect((err as WalletError).code).toBe(WalletErrorCode.INVALID_MNEMONIC);
    }
  });
});
