export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Wallet {
  address: string;
  publicKey: string;
  network: 'mainnet' | 'testnet';
  balance?: string;
}

export interface AuthState {
  // State
  user: User | null;
  wallet: Wallet | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Simple setters
  setUser: (user: User | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setError: (error: string | null) => void;

  // Complex actions
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithWallet: (wallet: Wallet) => Promise<void>;
  registerWithEmail: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  clearError: () => void;
}
