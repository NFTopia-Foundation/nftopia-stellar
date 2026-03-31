import { Keypair } from 'stellar-sdk';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('mockedhash'),
}));

jest.mock('stellar-hd-wallet', () => {
  const { Keypair: KP } = require('stellar-sdk');
  const mockKeypair = KP.random();
  return {
    __esModule: true,
    default: {
      generateMnemonic: jest.fn().mockReturnValue(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      ),
      fromMnemonic: jest.fn().mockReturnValue({
        getKeypair: jest.fn().mockReturnValue(mockKeypair),
      }),
    },
  };
});

import { StellarWalletService } from '../wallet.service';
import { SecureStorage } from '../secureStorage';
import { WalletError, WalletErrorCode } from '../types';

const VALID_SECRET_KEY = Keypair.random().secret();
const VALID_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function makeMockStorage(): jest.Mocked<SecureStorage> {
  return {
    saveWallet: jest.fn().mockResolvedValue(undefined),
    getWallet: jest.fn(),
    deleteWallet: jest.fn().mockResolvedValue(undefined),
    hasWallet: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<SecureStorage>;
}

describe('StellarWalletService', () => {
  let service: StellarWalletService;
  let mockStorage: jest.Mocked<SecureStorage>;

  beforeEach(() => {
    mockStorage = makeMockStorage();
    service = new StellarWalletService(mockStorage);
  });

  describe('createWallet', () => {
    it('creates a wallet with valid public and secret keys', async () => {
      const result = await service.createWallet();
      expect(result.wallet.publicKey).toBeTruthy();
      expect(result.wallet.secretKey).toBeTruthy();
      expect(service.isValidSecretKey(result.wallet.secretKey)).toBe(true);
    });

    it('saves the wallet to storage', async () => {
      await service.createWallet();
      expect(mockStorage.saveWallet).toHaveBeenCalledTimes(1);
    });

    it('passes password to storage when provided', async () => {
      await service.createWallet('my-password');
      expect(mockStorage.saveWallet).toHaveBeenCalledWith(expect.any(Object), 'my-password');
    });
  });

  describe('importFromSecretKey', () => {
    it('imports a wallet from a valid secret key', async () => {
      const wallet = await service.importFromSecretKey(VALID_SECRET_KEY);
      expect(wallet.secretKey).toBe(VALID_SECRET_KEY);
      expect(wallet.publicKey).toBe(service.getPublicKey(VALID_SECRET_KEY));
    });

    it('throws WalletError for an invalid secret key', async () => {
      await expect(service.importFromSecretKey('bad-key')).rejects.toThrow(WalletError);
      await expect(service.importFromSecretKey('bad-key')).rejects.toMatchObject({
        code: WalletErrorCode.INVALID_SECRET_KEY,
      });
    });

    it('saves the wallet to storage', async () => {
      await service.importFromSecretKey(VALID_SECRET_KEY);
      expect(mockStorage.saveWallet).toHaveBeenCalledTimes(1);
    });
  });

  describe('importFromMnemonic', () => {
    it('imports a wallet from a valid mnemonic', async () => {
      const wallet = await service.importFromMnemonic(VALID_MNEMONIC);
      expect(wallet.publicKey).toBeTruthy();
      expect(wallet.secretKey).toBeTruthy();
      expect(wallet.mnemonic).toBe(VALID_MNEMONIC);
    });

    it('throws WalletError for an invalid mnemonic', async () => {
      await expect(service.importFromMnemonic('too short')).rejects.toThrow(WalletError);
      await expect(service.importFromMnemonic('too short')).rejects.toMatchObject({
        code: WalletErrorCode.INVALID_MNEMONIC,
      });
    });

    it('saves the wallet to storage', async () => {
      await service.importFromMnemonic(VALID_MNEMONIC);
      expect(mockStorage.saveWallet).toHaveBeenCalledTimes(1);
    });
  });

  describe('signMessage', () => {
    it('returns a base64-encoded signature', async () => {
      const signature = await service.signMessage('hello', VALID_SECRET_KEY);
      expect(typeof signature).toBe('string');
      expect(Buffer.from(signature, 'base64').length).toBeGreaterThan(0);
    });

    it('throws WalletError for an invalid secret key', async () => {
      await expect(service.signMessage('hello', 'bad-key')).rejects.toThrow(WalletError);
      await expect(service.signMessage('hello', 'bad-key')).rejects.toMatchObject({
        code: WalletErrorCode.INVALID_SECRET_KEY,
      });
    });
  });

  describe('getPublicKey', () => {
    it('returns the correct public key for a secret key', () => {
      const expectedPublicKey = Keypair.fromSecret(VALID_SECRET_KEY).publicKey();
      expect(service.getPublicKey(VALID_SECRET_KEY)).toBe(expectedPublicKey);
    });

    it('throws WalletError for an invalid secret key', () => {
      expect(() => service.getPublicKey('bad-key')).toThrow(WalletError);
    });
  });

  describe('isValidSecretKey', () => {
    it('returns true for a valid key', () => {
      expect(service.isValidSecretKey(VALID_SECRET_KEY)).toBe(true);
    });

    it('returns false for an invalid key', () => {
      expect(service.isValidSecretKey('bad-key')).toBe(false);
    });
  });

  describe('isValidMnemonic', () => {
    it('returns true for a valid mnemonic', () => {
      expect(service.isValidMnemonic(VALID_MNEMONIC)).toBe(true);
    });

    it('returns false for an invalid mnemonic', () => {
      expect(service.isValidMnemonic('too short')).toBe(false);
    });
  });
});
