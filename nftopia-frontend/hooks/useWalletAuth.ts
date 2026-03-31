"use client";

import { useCallback } from "react";
import { useStellarWallet } from "@/components/wallet/hooks/useStellarWallet";
import { useStellarAuth } from "@/components/wallet/hooks/useStellarAuth";
import { useWalletStore } from "@/stores/walletStore";
import { WalletProvider } from "@/types/stellar";


export function useWalletAuth() {
  const walletStore = useWalletStore();
  const { connect, disconnect, balances, connecting, clearError: clearWalletError } = useStellarWallet();
  const { authenticateWithWallet, loading: authLoading, error: authError, clearError: clearAuthError } = useStellarAuth();

  const connectAndAuth = useCallback(
    async (provider: WalletProvider, onSuccess?: (token: string) => void) => {
      await connect(provider);
      const address = useWalletStore.getState().address;
      if (!address) return;
      await authenticateWithWallet(address, provider, onSuccess);
    },
    [connect, authenticateWithWallet]
  );

  const clearError = useCallback(() => {
    clearWalletError();
    clearAuthError();
  }, [clearWalletError, clearAuthError]);

  return {
    address: walletStore.address,
    provider: walletStore.provider,
    network: walletStore.network,
    connected: walletStore.connected,
    connecting,
    balances,
    authLoading,
    authError,
    connect,
    disconnect,
    connectAndAuth,
    clearError,
  };
}