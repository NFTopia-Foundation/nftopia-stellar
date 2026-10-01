import { Wallet } from '../src/services/stellar/types';

export interface User {
  id: string;
  email?: string;
  username?: string;
  walletAddress?: string;
  walletType?: 'argentx' | 'braavos' | 'stellar';
  isCreator?: boolean;
  createdAt?: Date;
}

export type AuthNavigatorScreen =
  | 'Onboarding'
  | 'WalletSelection'
  | 'WalletCreate'
  | 'WalletImport'
  | 'EmailLogin'
  | 'EmailRegister';

export interface AuthStore {
  // State
  user: User | null;
  wallet: Wallet | null;
  loading: boolean;
  isAuthenticated: boolean;
  isCreator: boolean;
  error: string | null;
  isCheckingAuth: boolean;
  lastLogin: string | null;

  // Session timeout / app-lock state
  sessionExpiryTime: number | null;
  warningThreshold: number;
  showExpiryWarning: boolean;
  isLocked: boolean;
  lockTimeout: number;
  failedUnlockAttempts: number;
  lockoutUntil: number | null;
  appLockEnabled: boolean;

  // Actions - State Management
  setUser: (user: User | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setIsCheckingAuth: (isChecking: boolean) => void;
  setIsCreator: (isCreator: boolean) => void;

  // Actions - Authentication
  initializeAuth: () => Promise<void>;
  loginWithWallet: (wallet: Wallet) => Promise<void>;
  logout: () => Promise<void>;

  // Actions - Session timeout / app-lock
  setShowExpiryWarning: (show: boolean) => void;
  setWarningThreshold: (seconds: number) => void;
  setLockTimeout: (seconds: number) => void;
  setAppLockEnabled: (enabled: boolean) => void;
  extendSession: () => Promise<boolean>;
  getSessionTimeRemaining: () => number | null;
  checkSessionExpiry: () => boolean;
  lockApp: () => void;
  unlockApp: (pin?: string) => Promise<boolean>;
  resetFailedAttempts: () => void;
  isInLockout: () => boolean;
  getLockoutRemaining: () => number;

  // Navigation actions
  navigateToScreen: (screen: AuthNavigatorScreen) => void;
  goBack: () => void;
  resetToScreen: (screen: AuthNavigatorScreen) => void;
}
