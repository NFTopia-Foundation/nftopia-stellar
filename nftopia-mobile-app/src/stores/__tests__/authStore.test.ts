import { Keypair } from 'stellar-sdk';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const asyncStorageStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(asyncStorageStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    asyncStorageStore[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete asyncStorageStore[key];
    return Promise.resolve();
  }),
  mergeItem: jest.fn(),
  clear: jest.fn(() => {
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(asyncStorageStore))),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

const secureStoreData: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    secureStoreData[key] = value;
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(secureStoreData[key] ?? null)),
  deleteItemAsync: jest.fn((key: string) => {
    delete secureStoreData[key];
    return Promise.resolve();
  }),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('mockedhash'),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useAuthStore } from '../authStore';
import { Wallet } from '../../services/stellar/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeWallet = (): Wallet => {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
};

function getStore() {
  return useAuthStore.getState();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      wallet: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    Object.keys(secureStoreData).forEach((k) => delete secureStoreData[k]);
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
  });

  // ── Initial state ───────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has the correct default values', () => {
      const { user, wallet, isAuthenticated, isLoading, error } = getStore();
      expect(user).toBeNull();
      expect(wallet).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });
  });

  // ── Simple setters ──────────────────────────────────────────────────────────

  describe('simple setters', () => {
    it('setUser updates the user field', () => {
      const user = { id: '1', email: 'a@b.com', username: 'alice' };
      getStore().setUser(user);
      expect(getStore().user).toEqual(user);
    });

    it('setUser accepts null', () => {
      getStore().setUser({ id: '1', email: 'a@b.com', username: 'alice' });
      getStore().setUser(null);
      expect(getStore().user).toBeNull();
    });

    it('setWallet updates the wallet field', () => {
      const wallet = makeWallet();
      getStore().setWallet(wallet);
      expect(getStore().wallet).toEqual(wallet);
    });

    it('setWallet accepts null', () => {
      getStore().setWallet(makeWallet());
      getStore().setWallet(null);
      expect(getStore().wallet).toBeNull();
    });

    it('setAuthenticated toggles isAuthenticated', () => {
      getStore().setAuthenticated(true);
      expect(getStore().isAuthenticated).toBe(true);
      getStore().setAuthenticated(false);
      expect(getStore().isAuthenticated).toBe(false);
    });

    it('setLoading toggles isLoading', () => {
      getStore().setLoading(true);
      expect(getStore().isLoading).toBe(true);
      getStore().setLoading(false);
      expect(getStore().isLoading).toBe(false);
    });

    it('setError stores the error message', () => {
      getStore().setError('something went wrong');
      expect(getStore().error).toBe('something went wrong');
    });

    it('clearError resets error to null', () => {
      getStore().setError('oops');
      getStore().clearError();
      expect(getStore().error).toBeNull();
    });
  });

  // ── loginWithWallet ─────────────────────────────────────────────────────────

  describe('loginWithWallet', () => {
    it('sets wallet and isAuthenticated on success', async () => {
      const wallet = makeWallet();
      await getStore().loginWithWallet(wallet);

      const { wallet: storedWallet, isAuthenticated, isLoading, error } = getStore();
      expect(storedWallet).toEqual(wallet);
      expect(isAuthenticated).toBe(true);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it('saves the wallet to secure storage', async () => {
      const SecureStore = require('expo-secure-store');
      const wallet = makeWallet();
      await getStore().loginWithWallet(wallet);
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('sets error when storage fails', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.setItemAsync.mockRejectedValueOnce(new Error('storage failure'));

      const wallet = makeWallet();
      await getStore().loginWithWallet(wallet);

      expect(getStore().error).toBe('Failed to save wallet: storage failure');
      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().isLoading).toBe(false);
    });

    it('does not run if isLoading is true', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.setItemAsync.mockClear();
      useAuthStore.setState({ isLoading: true });

      await getStore().loginWithWallet(makeWallet());
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  // ── loginWithEmail ──────────────────────────────────────────────────────────

  describe('loginWithEmail', () => {
    it('sets an error because the service is not yet implemented', async () => {
      await getStore().loginWithEmail('user@example.com', 'password123');
      expect(getStore().error).toBe('Email login not yet implemented');
      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().isLoading).toBe(false);
    });

    it('does not run if isLoading is true', async () => {
      useAuthStore.setState({ isLoading: true });
      const before = getStore().error;
      await getStore().loginWithEmail('user@example.com', 'password123');
      expect(getStore().error).toBe(before);
    });
  });

  // ── registerWithEmail ───────────────────────────────────────────────────────

  describe('registerWithEmail', () => {
    it('sets an error because the service is not yet implemented', async () => {
      await getStore().registerWithEmail('user@example.com', 'password123', 'alice');
      expect(getStore().error).toBe('Email registration not yet implemented');
      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().isLoading).toBe(false);
    });

    it('does not run if isLoading is true', async () => {
      useAuthStore.setState({ isLoading: true });
      const before = getStore().error;
      await getStore().registerWithEmail('user@example.com', 'password123', 'alice');
      expect(getStore().error).toBe(before);
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('clears user, wallet and isAuthenticated', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', username: 'alice' },
        wallet: makeWallet(),
        isAuthenticated: true,
      });

      await getStore().logout();

      const { user, wallet, isAuthenticated, isLoading } = getStore();
      expect(user).toBeNull();
      expect(wallet).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(isLoading).toBe(false);
    });

    it('deletes wallet from secure storage', async () => {
      const SecureStore = require('expo-secure-store');
      secureStoreData['nftopia_wallet'] = JSON.stringify(makeWallet());

      await getStore().logout();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nftopia_wallet');
    });

    it('removes auth token from AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      asyncStorageStore['nftopia_auth_token'] = 'some-token';

      await getStore().logout();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('nftopia_auth_token');
    });

    it('still clears state even when storage throws', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('delete failed'));

      useAuthStore.setState({ isAuthenticated: true, wallet: makeWallet() });
      await getStore().logout();

      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().wallet).toBeNull();
    });
  });

  // ── checkAuth ───────────────────────────────────────────────────────────────

  describe('checkAuth', () => {
    it('returns false and sets isAuthenticated false when nothing is stored', async () => {
      const result = await getStore().checkAuth();
      expect(result).toBe(false);
      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().isLoading).toBe(false);
    });

    it('returns true and sets isAuthenticated when auth token exists', async () => {
      asyncStorageStore['nftopia_auth_token'] = 'valid-token';

      const result = await getStore().checkAuth();
      expect(result).toBe(true);
      expect(getStore().isAuthenticated).toBe(true);
      expect(getStore().isLoading).toBe(false);
    });

    it('returns true and restores wallet when wallet is stored but no token', async () => {
      const wallet = makeWallet();
      secureStoreData['nftopia_wallet'] = JSON.stringify(wallet);

      const result = await getStore().checkAuth();
      expect(result).toBe(true);
      expect(getStore().isAuthenticated).toBe(true);
      expect(getStore().wallet).toEqual(wallet);
      expect(getStore().isLoading).toBe(false);
    });

    it('returns false and sets error when storage throws', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('read error'));

      const result = await getStore().checkAuth();
      expect(result).toBe(false);
      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().error).toBeTruthy();
      expect(getStore().isLoading).toBe(false);
    });
  });
});
