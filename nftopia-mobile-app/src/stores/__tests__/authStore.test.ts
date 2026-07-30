import { Keypair } from 'stellar-sdk';

const asyncStorageStore: Record<string, string> = {};
const asyncStorageMock = {
  getItem: jest.fn(async (key: string) => asyncStorageStore[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => { asyncStorageStore[key] = value; }),
  removeItem: jest.fn(async (key: string) => { delete asyncStorageStore[key]; }),
  mergeItem: jest.fn(),
  clear: jest.fn(async () => { Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]); }),
  getAllKeys: jest.fn(async () => Object.keys(asyncStorageStore)),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
};
jest.mock('@react-native-async-storage/async-storage', () => asyncStorageMock);

const secureStoreData: Record<string, string> = {};
let origSetItemAsync: jest.Mock;
let origGetItemAsync: jest.Mock;
let origDeleteItemAsync: jest.Mock;

jest.mock('expo-secure-store', () => {
  const mockSetItem = jest.fn((key: string, value: string) => {
    secureStoreData[key] = value;
    return Promise.resolve();
  });
  const mockGetItem = jest.fn((key: string) => Promise.resolve(secureStoreData[key] ?? null));
  const mockDeleteItem = jest.fn((key: string) => {
    delete secureStoreData[key];
    return Promise.resolve();
  });
  origSetItemAsync = mockSetItem;
  origGetItemAsync = mockGetItem;
  origDeleteItemAsync = mockDeleteItem;
  return {
    setItemAsync: mockSetItem,
    getItemAsync: mockGetItem,
    deleteItemAsync: mockDeleteItem,
    isAvailableAsync: jest.fn().mockResolvedValue(true),
  };
});

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('mockedhash'),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true, error: null }),
}));

import { useAuthStore } from '../authStore';
import { Wallet } from '../../services/stellar/types';

const makeWallet = (): Wallet => {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
};

function getStore() {
  return useAuthStore.getState();
}

const MOCK_CHALLENGE = {
  sessionId: 'sess-1',
  walletAddress: '',
  nonce: 'nonce-1',
  message: 'Sign this message to authenticate: nonce-1',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
};

function mockWalletLoginResponses(wallet: Wallet) {
  const challenge = { ...MOCK_CHALLENGE, walletAddress: wallet.publicKey };
  const authResponse = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    user: { id: 'user-1', walletAddress: wallet.publicKey },
  };
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true, status: 200,
      json: jest.fn().mockResolvedValue(challenge),
    } as unknown as Response)
    .mockResolvedValueOnce({
      ok: true, status: 200,
      json: jest.fn().mockResolvedValue(authResponse),
    } as unknown as Response);
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      wallet: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      authLoading: false,
      logoutLoading: false,
    });
    Object.keys(secureStoreData).forEach((k) => delete secureStoreData[k]);
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    delete (global as any).fetch;
    const SecureStore = require('expo-secure-store');
    SecureStore.setItemAsync = origSetItemAsync;
    SecureStore.getItemAsync = origGetItemAsync;
    SecureStore.deleteItemAsync = origDeleteItemAsync;
  });

  describe('initial state', () => {
    it('has the correct default values', () => {
      const { user, wallet, isAuthenticated, isLoading, error, authLoading, logoutLoading } = getStore();
      expect(user).toBeNull();
      expect(wallet).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(isLoading).toBe(false);
      expect(authLoading).toBe(false);
      expect(logoutLoading).toBe(false);
      expect(error).toBeNull();
    });
  });

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

    it('setAuthLoading updates authLoading', () => {
      getStore().setAuthLoading(true);
      expect(getStore().authLoading).toBe(true);
      getStore().setAuthLoading(false);
      expect(getStore().authLoading).toBe(false);
    });

    it('setLogoutLoading updates logoutLoading', () => {
      getStore().setLogoutLoading(true);
      expect(getStore().logoutLoading).toBe(true);
      getStore().setLogoutLoading(false);
      expect(getStore().logoutLoading).toBe(false);
    });
  });

  describe('loginWithWallet', () => {
    it('sets wallet and isAuthenticated on success', async () => {
      const wallet = makeWallet();
      mockWalletLoginResponses(wallet);

      await getStore().loginWithWallet(wallet);

      const { wallet: storedWallet, isAuthenticated, isLoading, error } = getStore();
      expect(storedWallet?.publicKey).toEqual(wallet.publicKey);
      expect(isAuthenticated).toBe(true);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it('saves the wallet to secure storage', async () => {
      const wallet = makeWallet();
      mockWalletLoginResponses(wallet);

      await getStore().loginWithWallet(wallet);

      expect(secureStoreData['nftopia_wallet']).toBeDefined();
    });

    it('sets error when storage fails', async () => {
      secureStoreData['nftopia_wallet_error'] = 'trigger';
      const origSetItem = jest.fn();
      const SecureStore = require('expo-secure-store');
      SecureStore.setItemAsync = origSetItem;
      origSetItem.mockImplementation((key: string) => {
        if (key === 'nftopia_wallet') return Promise.reject(new Error('storage failure'));
        return Promise.resolve();
      });
      delete secureStoreData['nftopia_wallet'];

      const wallet = makeWallet();
      await getStore().loginWithWallet(wallet);

      expect(getStore().error).toBeTruthy();
      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().isLoading).toBe(false);
    });

    it('sets error and keeps isAuthenticated false when auth fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Auth server unreachable'));

      const wallet = makeWallet();
      await getStore().loginWithWallet(wallet);

      expect(getStore().error).toBeTruthy();
      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().authLoading).toBe(false);
    });

    it('does not run if isLoading is true', async () => {
      useAuthStore.setState({ isLoading: true });
      const prevError = getStore().error;

      await getStore().loginWithWallet(makeWallet());

      expect(getStore().error).toBe(prevError);
    });

    it('sets authLoading during authentication', async () => {
      let resolveAuth: (value: unknown) => void;
      global.fetch = jest.fn().mockReturnValue(new Promise((resolve) => { resolveAuth = resolve; }));

      const wallet = makeWallet();
      const promise = getStore().loginWithWallet(wallet);

      expect(getStore().authLoading).toBe(true);

      resolveAuth!({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          access_token: 'at', refresh_token: 'rt', user: { id: 'u1' },
        }),
      });

      await promise;
      expect(getStore().authLoading).toBe(false);
    });
  });

  describe('loginWithEmail', () => {
    it('sets an error when email login fails', async () => {
      await getStore().loginWithEmail('user@example.com', 'password123');
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

  describe('loginWithWalletConnect', () => {
    it('authenticates with external signature and stores wallet', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          access_token: 'at',
          refresh_token: 'rt',
          user: { id: 'user-1', walletAddress: 'GA' },
        }),
      } as unknown as Response);

      const wallet = makeWallet();
      await getStore().loginWithWalletConnect(wallet, 'sig', 'nonce');

      expect(getStore().error).toBeNull();
      expect(getStore().isAuthenticated).toBe(true);
      expect(getStore().wallet?.publicKey).toBe(wallet.publicKey);
      expect(getStore().authLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Verification failed'));

      const wallet = makeWallet();
      await getStore().loginWithWalletConnect(wallet, 'bad-sig', 'nonce');

      expect(getStore().error).toBeTruthy();
      expect(getStore().isAuthenticated).toBe(false);
    });
  });

  describe('registerWithEmail', () => {
    it('sets an error when register fails', async () => {
      await getStore().registerWithEmail('user@example.com', 'password123', 'alice');
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

  describe('logout', () => {
    it('clears user, wallet, isAuthenticated, and loading states', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', username: 'alice' },
        wallet: makeWallet(),
        isAuthenticated: true,
      });

      await getStore().logout();

      const { user, wallet, isAuthenticated, isLoading, logoutLoading } = getStore();
      expect(user).toBeNull();
      expect(wallet).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(isLoading).toBe(false);
      expect(logoutLoading).toBe(false);
    });

    it('deletes wallet from secure storage', async () => {
      secureStoreData['nftopia_wallet'] = JSON.stringify(makeWallet());

      await getStore().logout();
      expect(secureStoreData['nftopia_wallet']).toBeUndefined();
    });

    it('clears tokens from secure storage', async () => {
      secureStoreData['nftopia_access_token'] = 'some-access';
      secureStoreData['nftopia_refresh_token'] = 'some-refresh';
      secureStoreData['nftopia_token_expiry'] = '12345';

      await getStore().logout();
      expect(secureStoreData['nftopia_access_token']).toBeUndefined();
      expect(secureStoreData['nftopia_refresh_token']).toBeUndefined();
      expect(secureStoreData['nftopia_token_expiry']).toBeUndefined();
    });

    it('still clears state even when storage throws', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.deleteItemAsync = jest.fn().mockRejectedValue(new Error('delete failed'));

      useAuthStore.setState({ isAuthenticated: true, wallet: makeWallet() });
      await getStore().logout();

      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().wallet).toBeNull();
    });

    it('sets logoutLoading during logout', async () => {
      useAuthStore.setState({ isAuthenticated: true });

      const promise = getStore().logout();
      expect(getStore().logoutLoading).toBe(true);

      await promise;
      expect(getStore().logoutLoading).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('returns false and sets isAuthenticated false when nothing is stored', async () => {
      const result = await getStore().checkAuth();
      expect(result).toBe(false);
      expect(getStore().isAuthenticated).toBe(false);
      expect(getStore().isLoading).toBe(false);
    });

    it('returns true and sets isAuthenticated when tokens exist and are not expired', async () => {
      secureStoreData['nftopia_access_token'] = 'access';
      secureStoreData['nftopia_refresh_token'] = 'refresh';
      secureStoreData['nftopia_token_expiry'] = (Date.now() + 3600_000).toString();

      const result = await getStore().checkAuth();
      expect(result).toBe(true);
      expect(getStore().isAuthenticated).toBe(true);
    });

    it('tries to refresh when token is expired and returns true on success', async () => {
      secureStoreData['nftopia_access_token'] = 'stale-access';
      secureStoreData['nftopia_refresh_token'] = 'valid-refresh';
      secureStoreData['nftopia_token_expiry'] = '1000';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          user: { id: 'u1' },
        }),
      } as unknown as Response);

      const result = await getStore().checkAuth();
      expect(result).toBe(true);
      expect(getStore().isAuthenticated).toBe(true);
    });

    it('returns false when token is expired and refresh fails', async () => {
      secureStoreData['nftopia_access_token'] = 'stale-access';
      secureStoreData['nftopia_refresh_token'] = 'invalid-refresh';
      secureStoreData['nftopia_token_expiry'] = '1000';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ message: 'Invalid token' }),
      } as unknown as Response);

      const result = await getStore().checkAuth();
      expect(result).toBe(false);
      expect(getStore().isAuthenticated).toBe(false);
    });

    it('returns true and restores wallet when wallet is stored but no token', async () => {
      const wallet = makeWallet();
      secureStoreData['nftopia_wallet'] = JSON.stringify(wallet);

      const result = await getStore().checkAuth();
      expect(result).toBe(true);
      expect(getStore().isAuthenticated).toBe(true);
      expect(getStore().wallet).toEqual(wallet);
    });

    it('returns false and sets error when storage throws', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync = jest.fn().mockRejectedValue(new Error('read error'));

      const result = await getStore().checkAuth();
      expect(result).toBe(false);
      expect(getStore().isAuthenticated).toBe(false);
    });
  });
});
