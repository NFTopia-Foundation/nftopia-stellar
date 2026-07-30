import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('mockedhash'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  mergeItem: jest.fn(),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

import { useAuthStore } from '../../src/stores/authStore';

function getStore() {
  return useAuthStore.getState();
}

describe('useAuth hook integration', () => {
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
    jest.clearAllMocks();
  });

  it('returns default unauthenticated state', () => {
    const state = getStore();
    expect(state.user).toBeNull();
    expect(state.wallet).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.authLoading).toBe(false);
    expect(state.logoutLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('provides all required action methods', () => {
    const state = getStore();
    expect(typeof state.loginWithWallet).toBe('function');
    expect(typeof state.loginWithEmail).toBe('function');
    expect(typeof state.loginWithWalletConnect).toBe('function');
    expect(typeof state.registerWithEmail).toBe('function');
    expect(typeof state.logout).toBe('function');
    expect(typeof state.checkAuth).toBe('function');
    expect(typeof state.setUser).toBe('function');
    expect(typeof state.setWallet).toBe('function');
    expect(typeof state.setAuthenticated).toBe('function');
    expect(typeof state.setLoading).toBe('function');
    expect(typeof state.setError).toBe('function');
    expect(typeof state.clearError).toBe('function');
    expect(typeof state.setAuthLoading).toBe('function');
    expect(typeof state.setLogoutLoading).toBe('function');
  });

  it('setUser updates user and setUser(null) clears it', () => {
    const user = { id: '1', email: 'test@test.com', username: 'testuser' };
    getStore().setUser(user);
    expect(getStore().user).toEqual(user);

    getStore().setUser(null);
    expect(getStore().user).toBeNull();
  });

  it('setWallet updates wallet', () => {
    const wallet = { publicKey: 'GA...', secretKey: 'SB...' };
    getStore().setWallet(wallet);
    expect(getStore().wallet).toEqual(wallet);
  });

  it('setAuthenticated updates isAuthenticated', () => {
    getStore().setAuthenticated(true);
    expect(getStore().isAuthenticated).toBe(true);
  });

  it('setLoading updates isLoading', () => {
    getStore().setLoading(true);
    expect(getStore().isLoading).toBe(true);
  });

  it('setError and clearError manage error state', () => {
    getStore().setError('An error occurred');
    expect(getStore().error).toBe('An error occurred');
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

  it('checkAuth returns false and clears state when no auth data present', async () => {
    const result = await getStore().checkAuth();
    expect(result).toBe(false);
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().isLoading).toBe(false);
  });

  it('logout clears all auth state', async () => {
    getStore().setUser({ id: '1', email: 'a@b.com', username: 'alice' });
    getStore().setAuthenticated(true);

    await getStore().logout();

    expect(getStore().user).toBeNull();
    expect(getStore().wallet).toBeNull();
    expect(getStore().isAuthenticated).toBe(false);
    expect(getStore().isLoading).toBe(false);
    expect(getStore().logoutLoading).toBe(false);
  });

  it('checkAuth identifies stored tokens as valid session', async () => {
    const SecureStoreMock = SecureStore as jest.Mocked<typeof SecureStore>;
    SecureStoreMock.getItemAsync.mockImplementation((key: string) => {
      if (key === 'nftopia_access_token') return Promise.resolve('access');
      if (key === 'nftopia_refresh_token') return Promise.resolve('refresh');
      if (key === 'nftopia_token_expiry') return Promise.resolve((Date.now() + 3600000).toString());
      return Promise.resolve(null);
    });

    const result = await getStore().checkAuth();
    expect(result).toBe(true);
    expect(getStore().isAuthenticated).toBe(true);
  });
});
