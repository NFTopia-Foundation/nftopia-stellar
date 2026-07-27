import { Wallet } from '../services/stellar/types';

export interface User {
  id: string;
  email: string;
  username: string;
}

export interface AuthState {
  user: User | null;
  wallet: Wallet | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number | null;
  sessionTimer: ReturnType<typeof setInterval> | null;

  setUser: (user: User | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  updateActivity: () => void;
  startSessionMonitor: () => void;
  stopSessionMonitor: () => void;

  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithWallet: (wallet: Wallet) => Promise<void>;
  registerWithEmail: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  requireBiometric: (promptMessage?: string) => Promise<boolean>;
}
