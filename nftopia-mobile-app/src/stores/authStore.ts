import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthState, User, Wallet } from './types';

// ---------------------------------------------------------------------------
// Auth service helpers
// These thin wrappers keep the store decoupled from any specific API client.
// Swap the implementations when the real auth service is ready.
// ---------------------------------------------------------------------------

async function apiLoginWithEmail(
  email: string,
  password: string,
): Promise<{ user: User; token: string }> {
  // TODO: replace with real API call, e.g. authApi.login({ email, password })
  throw new Error('Email login not yet implemented');
}

async function apiRegisterWithEmail(
  email: string,
  password: string,
  username: string,
): Promise<{ user: User; token: string }> {
  // TODO: replace with real API call
  throw new Error('Email registration not yet implemented');
}

async function apiLogout(): Promise<void> {
  // TODO: call token-invalidation endpoint if needed
}

async function apiVerifyToken(token: string): Promise<User | null> {
  // TODO: replace with real token-verification call
  return null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ── initial state ────────────────────────────────────────────────────
      user: null,
      wallet: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // ── simple setters ───────────────────────────────────────────────────
      setUser: (user) => set({ user }),
      setWallet: (wallet) => set({ wallet }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // ── complex actions ──────────────────────────────────────────────────

      loginWithEmail: async (email, password) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await apiLoginWithEmail(email, password);
          await AsyncStorage.setItem('auth_token', token);
          set({ user, isAuthenticated: true });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Login failed' });
        } finally {
          set({ isLoading: false });
        }
      },

      loginWithWallet: async (wallet: Wallet) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          // Wallet-based auth: store the wallet and mark as authenticated.
          // Extend here when a wallet-signing challenge flow is added.
          set({ wallet, isAuthenticated: true });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Wallet login failed' });
        } finally {
          set({ isLoading: false });
        }
      },

      registerWithEmail: async (email, password, username) => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await apiRegisterWithEmail(email, password, username);
          await AsyncStorage.setItem('auth_token', token);
          set({ user, isAuthenticated: true });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Registration failed' });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          await apiLogout();
          await AsyncStorage.removeItem('auth_token');
          set({ user: null, wallet: null, isAuthenticated: false });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Logout failed' });
        } finally {
          set({ isLoading: false });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true, error: null });
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (!token) {
            set({ isAuthenticated: false });
            return false;
          }
          const user = await apiVerifyToken(token);
          if (!user) {
            await AsyncStorage.removeItem('auth_token');
            set({ user: null, wallet: null, isAuthenticated: false });
            return false;
          }
          set({ user, isAuthenticated: true });
          return true;
        } catch {
          set({ isAuthenticated: false });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },
    }),

    {
      name: 'nftopia-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist non-sensitive, restorable state.
      // Tokens live in AsyncStorage directly; loading/error are transient.
      partialize: (state) => ({
        user: state.user,
        wallet: state.wallet,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
