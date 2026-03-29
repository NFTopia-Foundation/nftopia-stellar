import { SecureStorage } from '../secureStorage';
import { Wallet, WalletErrorCode } from '../types';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockImplementation((_algo: string, input: string) =>
    Promise.resolve(Buffer.from(input).toString('hex').slice(0, 64)),
  ),
}));

import * as SecureStore from 'expo-secure-store';

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

const SAMPLE_WALLET: Wallet = {
  publicKey: 'GABC123',
  secretKey: 'SABC123',
};

describe('SecureStorage', () => {
  let storage: SecureStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new SecureStorage();
  });

  describe('saveWallet', () => {
    it('stores wallet JSON without password', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      await storage.saveWallet(SAMPLE_WALLET);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'nftopia_wallet',
        JSON.stringify(SAMPLE_WALLET),
      );
    });

    it('stores encrypted data when password is provided', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      await storage.saveWallet(SAMPLE_WALLET, 'secret');
      const [, storedValue] = mockSecureStore.setItemAsync.mock.calls[0];
      expect(storedValue).not.toBe(JSON.stringify(SAMPLE_WALLET));
      expect(() => JSON.parse(storedValue)).not.toThrow();
    });
  });

  describe('getWallet', () => {
    it('returns null when no wallet is stored', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      const result = await storage.getWallet();
      expect(result).toBeNull();
    });

    it('returns wallet object when stored without password', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(SAMPLE_WALLET));
      const result = await storage.getWallet();
      expect(result).toEqual(SAMPLE_WALLET);
    });
  });

  describe('deleteWallet', () => {
    it('calls SecureStore.deleteItemAsync with the correct key', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
      await storage.deleteWallet();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('nftopia_wallet');
    });
  });

  describe('hasWallet', () => {
    it('returns true when a wallet exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(SAMPLE_WALLET));
      expect(await storage.hasWallet()).toBe(true);
    });

    it('returns false when no wallet exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      expect(await storage.hasWallet()).toBe(false);
    });
  });
});
