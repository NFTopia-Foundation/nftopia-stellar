import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Wallet } from '../services/stellar/types';
import { SecureStorage } from '../services/stellar/secureStorage';
import { WalletAuthService } from '../services/auth/walletAuth.service';
import { tokenStorage } from '../services/auth/tokenStorage';
import { AuthState } from './types';

const secureStorage = new SecureStorage();
const walletService = new WalletAuthService();

const AUTH_TOKEN_KEY = 'nftopia_auth_token';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      wallet: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      authLoading: false,
      logoutLoading: false,

      setUser: (user) => set({ user }),
      setWallet: (wallet) => set({ wallet }),
      setAuthenticated: (value) => set({ isAuthenticated: value }),
      setLoading: (value) => set({ isLoading: value }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      setAuthLoading: (value) => set({ authLoading: value }),
      setLogoutLoading: (value) => set({ logoutLoading: value }),

      loginWithEmail: async (email, password) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          const authService = (await import('../services/auth/auth.service')).authService;
          const response = await authService.emailLogin(email, password);
          set({
            user: {
              id: response.user.id,
              email: response.user.email,
              username: response.user.username,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: (err as Error).message,
            isLoading: false,
          });
        }
      },

      loginWithWallet: async (wallet: Wallet) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null, authLoading: true });
        try {
          await secureStorage.saveWallet(wallet);
          const authResponse = await walletService.walletLogin(wallet);
          set({
            wallet,
            user: authResponse.user,
            isAuthenticated: true,
            isLoading: false,
            authLoading: false,
          });
        } catch (err) {
          set({
            error: (err as Error).message,
            isAuthenticated: false,
            isLoading: false,
            authLoading: false,
          });
        }
      },

      loginWithWalletConnect: async (wallet: Wallet, signature: string, nonce: string) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null, authLoading: true });
        try {
          const authResponse = await walletService.authenticate(
            wallet.publicKey,
            signature,
            nonce,
          );
          await secureStorage.saveWallet(wallet);
          set({
            wallet,
            user: authResponse.user,
            isAuthenticated: true,
            isLoading: false,
            authLoading: false,
          });
        } catch (err) {
          set({
            error: (err as Error).message,
            isAuthenticated: false,
            isLoading: false,
            authLoading: false,
          });
        }
      },

      registerWithEmail: async (email, password, username) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          const authService = (await import('../services/auth/auth.service')).authService;
          const response = await authService.emailRegister(email, password, username);
          set({
            user: {
              id: response.user.id,
              email: response.user.email,
              username: response.user.username,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: (err as Error).message,
            isLoading: false,
          });
        }
      },

      logout: async () => {
        set({ isLoading: true, logoutLoading: true, error: null });
        try {
          await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
          await secureStorage.deleteWallet();
          await tokenStorage.clearTokens();
        } catch {
        } finally {
          set({
            user: null,
            wallet: null,
            isAuthenticated: false,
            isLoading: false,
            logoutLoading: false,
          });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true, error: null });
        try {
          const tokensStored = await tokenStorage.areTokensStored();
          if (tokensStored) {
            const expired = await tokenStorage.isTokenExpired();
            if (expired) {
              const refreshed = await walletService.refreshSession();
              if (!refreshed) {
                await tokenStorage.clearTokens();
                set({ isAuthenticated: false, isLoading: false });
                return false;
              }
            }
            set({ isAuthenticated: true, isLoading: false });
            return true;
          }

          const hasWallet = await secureStorage.hasWallet();
          if (hasWallet) {
            const wallet = await secureStorage.getWallet();
            set({ wallet, isAuthenticated: true, isLoading: false });
            return true;
          }

          set({ isAuthenticated: false, isLoading: false });
          return false;
        } catch (err) {
          set({
            error: (err as Error).message,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        }
      },
    }),
    {
      name: 'nftopia-auth-storage',
      storage: createJSONStorage(() => ({
        getItem: async (key: string) => await SecureStore.getItemAsync(key),
        setItem: async (key: string, value: string) => await SecureStore.setItemAsync(key, value),
        removeItem: async (key: string) => await SecureStore.deleteItemAsync(key),
      })),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
