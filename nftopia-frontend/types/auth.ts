import { WalletProvider, StellarNetwork } from "./stellar";


// --- Updated for unified auth context ---
export interface User {
  id: string;
  email?: string;
  username?: string;
  address?: string;
  walletAddress?: string;
  walletProvider?: string;
}


export interface LinkedWallet {
  id: string;
  walletAddress: string;
  walletProvider: string;
  isPrimary: boolean;
  lastUsedAt: string;
}

// For backward compatibility, export UserWallet as LinkedWallet
export type UserWallet = LinkedWallet;

export interface AuthSession {
  token: string;
  user: User;
  authMethod: "email" | "wallet";
  expiresAt: number;
}


export interface WalletAuthResult {
  token: string;
  user: User;
  isNewUser: boolean;
}

export interface EmailAuthCredentials {
  email: string;
  password: string;
}


export interface WalletRegistrationPayload {
  walletAddress: string;
  provider: WalletProvider;
  network: StellarNetwork;
  username?: string;
}