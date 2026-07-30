import { Wallet } from '../services/stellar/types';
import { User } from '../services/auth/types';

export type { User };

export interface AuthState {
  user: User | null;
  wallet: Wallet | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authLoading: boolean;
  logoutLoading: boolean;

  setUser: (user: User | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setAuthLoading: (value: boolean) => void;
  setLogoutLoading: (value: boolean) => void;

  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithWallet: (wallet: Wallet) => Promise<void>;
  loginWithWalletConnect: (wallet: Wallet, signature: string, nonce: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}
