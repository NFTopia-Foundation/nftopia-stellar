"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuthStore } from "../stores/auth-store";
import { User, UserWallet } from "@/types/auth";
// Import the full AuthStore type from the store, but override User to match types/auth
import type { AuthStore as StoreAuthStore } from "../stores/types";

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithWallet: (address: string, walletProvider?: string) => Promise<void>;
  register: (email: string, password: string, username?: string) => Promise<void>;
  logout: () => void;
  linkWallet: (address: string, walletProvider?: string) => Promise<void>;
  unlinkWallet: (address: string) => Promise<void>;
  wallets: UserWallet[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Cast auth to the correct extended type
  const auth = useAuthStore() as unknown as StoreAuthStore & {
    register: (email: string, password: string, username?: string) => Promise<void>;
    emailLogin: (email: string, password: string) => Promise<void>;
    getWalletChallenge: (address: string, walletProvider?: string) => Promise<any>;
    linkWallet: (address: string, walletProvider?: string) => Promise<void>;
    unlinkWallet: (address: string) => Promise<void>;
    listWallets: () => Promise<UserWallet[]>;
    logout: () => void;
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
  };
  const [wallets, setWallets] = useState<UserWallet[]>([]);

  // Load wallets on user change
  useEffect(() => {
    if (auth.user) {
      auth.listWallets().then(setWallets).catch(() => setWallets([]));
    } else {
      setWallets([]);
    }
  }, [auth.user]);

  const loginWithEmail = async (email: string, password: string) => {
    await auth.emailLogin(email, password);
  };

  const loginWithWallet = async (address: string, walletProvider?: string) => {
    // 1. Get challenge
    const challenge = await auth.getWalletChallenge(address, walletProvider);
    // 2. Ask user to sign challenge.message with wallet (handled in UI)
    // 3. Send signature to backend for verification
    // This function should be completed in the wallet connect UI flow
    // Here, just a placeholder for context API
    throw new Error("loginWithWallet should be handled in the wallet connect UI flow");
  };

  const register = async (email: string, password: string, username?: string) => {
    await auth.register(email, password, username);
  };

  const logout = () => {
    auth.logout();
  };

  const linkWallet = async (address: string, walletProvider?: string) => {
    // 1. Get challenge
    const challenge = await auth.getWalletChallenge(address, walletProvider);
    // 2. Ask user to sign challenge.message with wallet (handled in UI)
    // 3. Send signature to backend for linking
    // This function should be completed in the wallet linking UI flow
    throw new Error("linkWallet should be handled in the wallet linking UI flow");
  };

  const unlinkWallet = async (address: string) => {
    await auth.unlinkWallet(address);
    setWallets(await auth.listWallets() || []);
  };

  const value: AuthContextType = {
    user: auth.user as User | null,
    isLoading: auth.loading,
    isAuthenticated: auth.isAuthenticated,
    loginWithEmail,
    loginWithWallet,
    register,
    logout,
    linkWallet,
    unlinkWallet,
    wallets,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
