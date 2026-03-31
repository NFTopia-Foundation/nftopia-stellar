import { WalletProvider, StellarNetwork } from "./stellar";

export interface BaseUser {
  id: string;
  email?: string;
  username?: string;
  walletAddress?: string;
  linkedWallets?: LinkedWallet[];
}

export interface LinkedWallet {
  address: string;
  provider: WalletProvider;
  linkedAt: string;
  isPrimary: boolean;
}

export interface AuthSession {
  token: string;
  user: BaseUser;
  authMethod: "email" | "wallet";
  expiresAt: number;
}

export interface WalletAuthResult {
  token: string;
  user: BaseUser;
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