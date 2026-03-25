/**
 * AuthStore stub — full implementation tracked in Issue #115.
 *
 * This interface matches the spec in Issue #115 and is consumed by the
 * wallet creation/import screens (Issue #117). Replace with the real
 * Zustand implementation once Issue #115 is merged.
 */

import { Wallet } from '../services/stellar/types';

export interface User {
  id: string;
  email?: string;
  username?: string;
}

export interface AuthState {
  user: User | null;
  wallet: Wallet | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  loginWithWallet: (wallet: Wallet) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Placeholder hook — replace with `create<AuthState>(...)` from zustand (Issue #115)
export const useAuthStore = (_selector: (state: AuthState) => unknown): never => {
  throw new Error('useAuthStore not yet implemented (Issue #115)');
};
