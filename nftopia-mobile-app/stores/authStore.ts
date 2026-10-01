import { createStore } from '@/src/utils/store.factory';
import { AuthStore, User } from '@/types/auth';
import { Wallet } from '@/src/services/stellar/types';
import { walletAuthService } from '@/src/services/auth/walletAuth.service';
import { tokenStorage } from '@/src/services/auth/tokenStorage';
import { useWalletStore } from '@/stores/walletStore';

export const VERSION = 3;

// Migrations for auth store
const migrations = [
  {
    version: 1,
    up: (state: any) => {
      // Add isCreator field if missing
      return {
        ...state,
        isCreator: state.user?.isCreator || false,
      };
    },
  },
  {
    version: 2,
    up: (state: any) => {
      // Add lastLogin field
      return {
        ...state,
        lastLogin: state.lastLogin || new Date().toISOString(),
      };
    },
  },
  {
    version: 3,
    up: (state: any) => {
      // Add app-lock preferences (#399) — off by default so nobody who
      // upgrades is unexpectedly locked out.
      return {
        ...state,
        appLockEnabled: state.appLockEnabled ?? false,
        lockTimeout: state.lockTimeout ?? 60,
      };
    },
  },
];

/** Default: warn 5 minutes before expiry. */
const DEFAULT_WARNING_THRESHOLD_SECONDS = 300;
/** Default: re-lock after 60s in the background, once app-lock is enabled. */
const DEFAULT_LOCK_TIMEOUT_SECONDS = 60;
const MAX_UNLOCK_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30_000;

const initialState: AuthStore = {
  user: null,
  wallet: null,
  loading: false,
  isAuthenticated: false,
  isCreator: false,
  error: null,
  isCheckingAuth: true,
  lastLogin: null,

  sessionExpiryTime: null,
  warningThreshold: DEFAULT_WARNING_THRESHOLD_SECONDS,
  showExpiryWarning: false,
  isLocked: false,
  lockTimeout: DEFAULT_LOCK_TIMEOUT_SECONDS,
  failedUnlockAttempts: 0,
  lockoutUntil: null,
  appLockEnabled: false,

  setUser: () => {},
  setWallet: () => {},
  setLoading: () => {},
  setError: () => {},
  clearError: () => {},
  setIsCheckingAuth: () => {},
  setIsCreator: () => {},
  initializeAuth: async () => {},
  loginWithWallet: async () => {},
  logout: async () => {},
  setShowExpiryWarning: () => {},
  setWarningThreshold: () => {},
  setLockTimeout: () => {},
  setAppLockEnabled: () => {},
  extendSession: async () => false,
  getSessionTimeRemaining: () => null,
  checkSessionExpiry: () => false,
  lockApp: () => {},
  unlockApp: async () => false,
  resetFailedAttempts: () => {},
  isInLockout: () => false,
  getLockoutRemaining: () => 0,
  navigateToScreen: () => {},
  goBack: () => {},
  resetToScreen: () => {},
};

export const useAuthStore = createStore<AuthStore>({
  name: 'auth-store',
  initialState,
  actions: (set, get) => ({
    ...initialState,

    // State Management Actions
    setUser: (user: User | null) =>
      set({
        user,
        isAuthenticated: !!user,
        isCreator: user?.isCreator || false,
        lastLogin: user ? new Date().toISOString() : get().lastLogin,
      }),

    setWallet: (wallet: Wallet | null) => set({ wallet }),
    setLoading: (loading: boolean) => set({ loading }),
    setError: (error: string | null) => set({ error }),
    clearError: () => set({ error: null }),
    setIsCheckingAuth: (isChecking: boolean) => set({ isCheckingAuth: isChecking }),
    setIsCreator: (isCreator: boolean) => set({ isCreator }),

    // Authentication Actions
    initializeAuth: async () => {
      set({ isCheckingAuth: true, loading: true });
      try {
        const hasValidSession = await tokenStorage.hasValidSession();
        let sessionValid = false;

        if (hasValidSession) {
          sessionValid = true;
        } else {
          const refreshToken = await tokenStorage.getRefreshToken();
          if (refreshToken) {
            try {
              await walletAuthService.refreshAccessToken();
              sessionValid = true;
            } catch {
              sessionValid = false;
            }
          }
        }

        if (sessionValid) {
          // A token that's locally unexpired can still have been revoked
          // server-side (password change, admin action, blacklisted after
          // logout on another device) — confirm with the server rather
          // than trusting the local expiry check alone.
          try {
            await walletAuthService.validateSession();
          } catch {
            sessionValid = false;
          }
        }

        if (sessionValid) {
          const expiry = await tokenStorage.getTokenExpiryTime();
          set({
            isAuthenticated: true,
            sessionExpiryTime: expiry,
            isLocked: get().appLockEnabled,
          });
        } else {
          await tokenStorage.clearTokens();
          useWalletStore.getState().disconnectWallet();
          set({ isAuthenticated: false, user: null, wallet: null, sessionExpiryTime: null });
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to restore session',
          isAuthenticated: false,
        });
      } finally {
        set({ isCheckingAuth: false, loading: false });
      }
    },

    // Full challenge -> sign -> verify wallet login, replacing any prior session.
    loginWithWallet: async (wallet: Wallet) => {
      set({ loading: true, error: null });
      try {
        const authResponse = await walletAuthService.walletLogin(wallet);
        const expiry = await tokenStorage.getTokenExpiryTime();
        set({
          user: {
            id: authResponse.user.id,
            email: authResponse.user.email,
            username: authResponse.user.username,
            walletAddress: authResponse.user.walletAddress,
          },
          wallet,
          isAuthenticated: true,
          isCreator: false,
          loading: false,
          lastLogin: new Date().toISOString(),
          sessionExpiryTime: expiry,
          isLocked: false,
          failedUnlockAttempts: 0,
          lockoutUntil: null,
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to sign in with wallet',
          loading: false,
        });
        // Re-throw so the calling screen (which owns its own submit/loading
        // UI) knows not to proceed past the login step.
        throw error;
      }
    },

    logout: async () => {
      try {
        set({ loading: true });
        // The auth session (tokens) and the wallet *connection* are
        // cleared here — the wallet's keys stay on device (via the
        // separate wallet store's `disconnectWallet`, not `clearWallets`)
        // so the user can sign back in without re-entering their secret
        // key or recovery phrase.
        await tokenStorage.clearTokens();
        useWalletStore.getState().disconnectWallet();
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to logout',
        });
      } finally {
        set({
          user: null,
          wallet: null,
          isAuthenticated: false,
          isCreator: false,
          loading: false,
          error: null,
          sessionExpiryTime: null,
          showExpiryWarning: false,
          isLocked: false,
          failedUnlockAttempts: 0,
          lockoutUntil: null,
        });
      }
    },

    // Session timeout / app-lock actions
    setShowExpiryWarning: (show: boolean) => set({ showExpiryWarning: show }),
    setWarningThreshold: (seconds: number) => set({ warningThreshold: seconds }),
    setLockTimeout: (seconds: number) => set({ lockTimeout: seconds }),
    setAppLockEnabled: (enabled: boolean) => set({ appLockEnabled: enabled }),

    // Exchanges the refresh token for a new access/refresh pair and moves
    // the session expiry out accordingly. Never throws — a failure here
    // means the refresh token itself is no longer valid, which callers
    // (SessionExpiryModal, the polling check in useAuth) treat as "fall
    // back to login" by calling `logout()` themselves on a `false` return.
    extendSession: async (): Promise<boolean> => {
      try {
        await walletAuthService.refreshAccessToken();
        const expiry = await tokenStorage.getTokenExpiryTime();
        set({ sessionExpiryTime: expiry, showExpiryWarning: false });
        return true;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to extend session' });
        return false;
      }
    },

    getSessionTimeRemaining: (): number | null => {
      const { sessionExpiryTime } = get();
      if (!sessionExpiryTime) return null;
      const now = Math.floor(Date.now() / 1000);
      const remaining = sessionExpiryTime - now;
      return remaining > 0 ? remaining : 0;
    },

    checkSessionExpiry: (): boolean => {
      const remaining = get().getSessionTimeRemaining();
      return remaining === null ? false : remaining <= 0;
    },

    lockApp: () => set({ isLocked: true }),

    // `pin` is accepted for forward-compatibility with a future PIN-entry
    // flow; there's no PIN storage/verification implemented yet, so a PIN
    // attempt always counts as a failure rather than silently pretending
    // to check one. Calling with no `pin` is the biometric-success path
    // (the caller has already run the biometric prompt itself).
    unlockApp: async (pin?: string): Promise<boolean> => {
      const { appLockEnabled, failedUnlockAttempts } = get();

      if (!appLockEnabled) {
        set({ isLocked: false });
        return true;
      }

      if (get().isInLockout()) {
        return false;
      }

      if (pin) {
        const attempts = failedUnlockAttempts + 1;
        if (attempts >= MAX_UNLOCK_ATTEMPTS) {
          set({ lockoutUntil: Date.now() + LOCKOUT_DURATION_MS, failedUnlockAttempts: 0 });
        } else {
          set({ failedUnlockAttempts: attempts });
        }
        return false;
      }

      set({ isLocked: false, failedUnlockAttempts: 0, lockoutUntil: null });
      return true;
    },

    resetFailedAttempts: () => set({ failedUnlockAttempts: 0, lockoutUntil: null }),

    isInLockout: (): boolean => {
      const { lockoutUntil } = get();
      if (!lockoutUntil) return false;
      return Date.now() < lockoutUntil;
    },

    getLockoutRemaining: (): number => {
      const { lockoutUntil } = get();
      if (!lockoutUntil) return 0;
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    },

    // Navigation Actions
    navigateToScreen: (_screen: string) => {
      // Will be handled by React Navigation
    },

    goBack: () => {
      // Will be handled by React Navigation
    },

    resetToScreen: (_screen: string) => {
      // Will be handled by React Navigation
    },
  }),
  persist: {
    enabled: true,
    name: 'auth-storage',
    version: VERSION,
    migrate: async (state: any, version: number) => {
      let migratedState = state;
      for (const migration of migrations) {
        if (migration.version > version) {
          migratedState = await migration.up(migratedState);
        }
      }
      return migratedState;
    },
    partialize: (state: AuthStore) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      isCreator: state.isCreator,
      lastLogin: state.lastLogin,
      appLockEnabled: state.appLockEnabled,
      lockTimeout: state.lockTimeout,
    }),
    // Encrypted (not just SecureStore's own at-rest encryption) since this
    // includes `user` — see `createEncryptedStorage` in persistence.utils.ts.
    storage: 'encrypted',
  },
  devtools: {
    enabled: __DEV__,
    name: 'AuthStore',
  },
});
