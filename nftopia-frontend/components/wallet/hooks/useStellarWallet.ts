"use client";

import { useState, useCallback, useEffect } from "react";
import { StellarNetwork, WalletProvider } from "@/types/stellar";
import { connectFreighter, getFreighterAddress, isFreighterConnected } from "@/lib/stellar/wallet/freighter";
import { connectAlbedo } from "@/lib/stellar/wallet/albedo";
import { connectWalletConnect, disconnectWalletConnect, isWalletConnectConnected } from "@/lib/stellar/wallet/walletconnect";
import { defaultNetwork } from "@/lib/stellar/client";
import { getHorizonServer } from "@/lib/stellar/client";
import { useWalletStore } from "@/stores/walletStore";

const WALLET_STORAGE_KEY = "stellar_wallet_connection";

interface PersistedWallet {
  address: string;
  provider: WalletProvider;
  network: StellarNetwork;
}

export function useStellarWallet() {
  const {
    address,
    provider,
    network,
    connected,
    connecting,
    error,
    setConnected,
    setDisconnected,
    setConnecting,
    setError,
  } = useWalletStore();

  const [balances, setBalances] = useState<{ asset: string; balance: string }[]>([]);

  // Restore persisted connection on mount
  useEffect(() => {
    const restoreConnection = async () => {
      if (typeof window === "undefined") return;
      const raw = sessionStorage.getItem(WALLET_STORAGE_KEY);
      if (!raw) return;

      try {
        const persisted: PersistedWallet = JSON.parse(raw);
        if (persisted.provider === "freighter") {
          const stillConnected = await isFreighterConnected();
          if (stillConnected) {
            const currentAddress = await getFreighterAddress();
            if (currentAddress === persisted.address) {
              setConnected(persisted.address, persisted.provider, persisted.network);
              return;
            }
          }
        } else if (persisted.provider === "walletconnect") {
          const stillConnected = await isWalletConnectConnected(persisted.network, persisted.address);
          if (stillConnected) {
            setConnected(persisted.address, persisted.provider, persisted.network);
            return;
          }
        }
        // Persisted session no longer valid
        sessionStorage.removeItem(WALLET_STORAGE_KEY);
      } catch {
        sessionStorage.removeItem(WALLET_STORAGE_KEY);
      }
    };

    restoreConnection();
  }, []);

  // Fetch balances when address changes
  useEffect(() => {
    if (!address) {
      setBalances([]);
      return;
    }
    fetchBalances(address, network);
  }, [address, network]);

  const fetchBalances = async (address: string, network: StellarNetwork) => {
    try {
      const server = getHorizonServer(network);
      const account = await server.loadAccount(address);
      const mapped = account.balances.map((b) => ({
        asset:
          b.asset_type === "native"
            ? "XLM"
            : `${(b as any).asset_code}:${(b as any).asset_issuer}`,
        balance: b.balance,
      }));
      setBalances(mapped);
    } catch {
      // Account may not be funded on testnet yet
      setBalances([]);
    }
  };

  const connect = useCallback(async (provider: WalletProvider) => {
    setConnecting(true);
    setError(null);

    try {
      let nextAddress: string;

      switch (provider) {
        case "freighter":
          nextAddress = await connectFreighter();
          break;
        case "albedo":
          nextAddress = await connectAlbedo();
          break;
        case "walletconnect":
          nextAddress = await connectWalletConnect(defaultNetwork);
          break;
        default:
          throw new Error(`Provider "${provider}" is not yet supported`);
      }

      const persisted: PersistedWallet = {
        address: nextAddress,
        provider,
        network: defaultNetwork,
      };
      sessionStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(persisted));

      setConnected(nextAddress, provider, defaultNetwork);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      let displayError = message;
      
      // Clear recovery actions for failed connections
      if (message.toLowerCase().includes("user rejected") || message.toLowerCase().includes("closed")) {
        displayError = "Connection request was cancelled. Please try again when ready.";
      } else if (message.includes("No Stellar account")) {
        displayError = "Your wallet didn't provide a Stellar account. Make sure you are on the correct network (Testnet/Public).";
      } else if (message.includes("No active WalletConnect session")) {
        displayError = "Your session expired. Please disconnect and reconnect your wallet.";
      }
      
      setError(displayError);
    }
  }, [setConnected, setConnecting, setError]);

  const disconnect = useCallback(() => {
    sessionStorage.removeItem(WALLET_STORAGE_KEY);
    if (provider === "walletconnect") {
      disconnectWalletConnect().catch(console.error);
    }
    setDisconnected();
    setBalances([]);
  }, [provider, setDisconnected]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    address,
    provider,
    network,
    connected,
    connecting,
    error,
    balances,
    connect,
    disconnect,
    clearError,
    refetchBalances: () =>
      address ? fetchBalances(address, network) : undefined,
  };
}