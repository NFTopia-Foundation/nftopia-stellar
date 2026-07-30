import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../src/stores/authStore';
import { Wallet } from '../src/services/stellar/types';
import { tokenStorage } from '../src/services/auth/tokenStorage';

export function useAuth() {
  const store = useAuthStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loginWithWallet = useCallback(
    async (wallet: Wallet) => {
      await store.loginWithWallet(wallet);
    },
    [store.loginWithWallet],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      await store.loginWithEmail(email, password);
    },
    [store.loginWithEmail],
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string, username: string) => {
      await store.registerWithEmail(email, password, username);
    },
    [store.registerWithEmail],
  );

  const loginWithWalletConnect = useCallback(
    async (wallet: Wallet, signature: string, nonce: string) => {
      await store.loginWithWalletConnect(wallet, signature, nonce);
    },
    [store.loginWithWalletConnect],
  );

  const logout = useCallback(async () => {
    await store.logout();
  }, [store.logout]);

  const checkAuth = useCallback(async () => {
    return store.checkAuth();
  }, [store.checkAuth]);

  const isSessionExpired = useCallback(async (): Promise<boolean> => {
    const info = await tokenStorage.getTokenInfo();
    if (!info) return true;
    return Date.now() >= info.expiresAt;
  }, []);

  const requireBiometricAccess = useCallback(async (): Promise<boolean> => {
    return tokenStorage.requireBiometricAccess();
  }, []);

  useEffect(() => {
    if (store.isAuthenticated) {
      intervalRef.current = setInterval(async () => {
        const expired = await isSessionExpired();
        if (expired) {
          const info = await tokenStorage.getTokenInfo();
          if (info) {
            await logout();
          }
        }
      }, 30000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [store.isAuthenticated, isSessionExpired, logout]);

  return {
    user: store.user,
    wallet: store.wallet,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    authLoading: store.authLoading,
    logoutLoading: store.logoutLoading,
    error: store.error,
    setUser: store.setUser,
    setWallet: store.setWallet,
    clearError: store.clearError,
    loginWithWallet,
    loginWithEmail,
    loginWithWalletConnect,
    registerWithEmail,
    logout,
    checkAuth,
    isSessionExpired,
    requireBiometricAccess,
  };
}
