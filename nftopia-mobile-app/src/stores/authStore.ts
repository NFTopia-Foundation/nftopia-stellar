import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Wallet } from '../services/stellar/types';
import { SecureStorage } from '../services/stellar/secureStorage';
import { tokenStorage } from '../services/auth/tokenStorage';
import { authService } from '../services/auth/auth.service';
import { AuthState, User } from './types';

const secureStorage = new SecureStorage();
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

function getCurrentTimestamp(): number {
  return Date.now();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      wallet: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivity: null,
      sessionTimer: null,

      setUser: (user) => set({ user }),
      setWallet: (wallet) => set({ wallet }),
      setAuthenticated: (value) => set({ isAuthenticated: value }),
      setLoading: (value) => set({ isLoading: value }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      updateActivity: () => {
        set({ lastActivity: getCurrentTimestamp() });
      },

      startSessionMonitor: () => {
        const existing = get().sessionTimer;
        if (existing) clearInterval(existing);
        const timer = setInterval(() => {
          const state = get();
          if (!state.isAuthenticated) {
            clearInterval(timer);
            return;
          }
          const lastActivity = state.lastActivity ?? getCurrentTimestamp();
          if (getCurrentTimestamp() - lastActivity > SESSION_TIMEOUT_MS) {
            get().logout();
          }
        }, 30000);
        set({ sessionTimer: timer, lastActivity: getCurrentTimestamp() });
      },

      stopSessionMonitor: () => {
        const timer = get().sessionTimer;
        if (timer) {
          clearInterval(timer);
          set({ sessionTimer: null });
        }
      },

      loginWithEmail: async (email, password) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          const response = await authService.emailLogin(email, password);
          set({
            user: response.user,
            isAuthenticated: true,
          });
          get().startSessionMonitor();
        } catch (err) {
          const message = (err as { message?: string }).message ?? 'Login failed';
          set({ error: message });
        } finally {
          set({ isLoading: false });
        }
      },

      loginWithWallet: async (wallet: Wallet) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          await secureStorage.saveWallet(wallet);
          set({ wallet, isAuthenticated: true });
          get().startSessionMonitor();
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ isLoading: false });
        }
      },

      registerWithEmail: async (email, password, username) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          const response = await authService.emailRegister(email, password, username);
          set({
            user: response.user,
            isAuthenticated: true,
          });
          get().startSessionMonitor();
        } catch (err) {
          const message = (err as { message?: string }).message ?? 'Registration failed';
          set({ error: message });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          get().stopSessionMonitor();
          await authService.logout();
          await secureStorage.deleteWallet();
        } catch {
          // Ignore storage errors on logout to ensure state is always cleared
        } finally {
          set({
            user: null,
            wallet: null,
            isAuthenticated: false,
            isLoading: false,
            lastActivity: null,
          });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true, error: null });
        try {
          await tokenStorage.migrateIfNeeded();

          const token = await SecureStore.getItemAsync('nftopia_auth_token');
          if (token) {
            const isValid = await authService.validateToken();
            if (isValid) {
              set({ isAuthenticated: true });
              get().startSessionMonitor();
              return true;
            }
            await SecureStore.deleteItemAsync('nftopia_auth_token');
          }

          const storedToken = await tokenStorage.getAccessToken();
          if (storedToken) {
            const isValid = await authService.validateToken();
            if (isValid) {
              const userData = await tokenStorage.getUserData();
              if (userData && userData.id) {
                set({
                  user: userData as unknown as User,
                  isAuthenticated: true,
                });
              } else {
                set({ isAuthenticated: true });
              }
              get().startSessionMonitor();
              return true;
            }
            await tokenStorage.clearTokens();
          }

          const hasWallet = await secureStorage.hasWallet();
          if (hasWallet) {
            const wallet = await secureStorage.getWallet();
            set({ wallet, isAuthenticated: true });
            get().startSessionMonitor();
            return true;
          }

          set({ isAuthenticated: false });
          return false;
        } catch (err) {
          set({ error: (err as Error).message, isAuthenticated: false });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      requireBiometric: async (promptMessage?: string): Promise<boolean> => {
        try {
          const { isEnrolledAsync, hasHardwareAsync, authenticateAsync } =
            await import('expo-local-authentication');
          const hasHardware = await hasHardwareAsync();
          if (!hasHardware) return true;
          const isEnrolled = await isEnrolledAsync();
          if (!isEnrolled) return true;
          const result = await authenticateAsync({
            promptMessage: promptMessage ?? 'Authenticate to perform this action',
            fallbackLabel: 'Use passcode',
          });
          return result.success;
        } catch {
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
