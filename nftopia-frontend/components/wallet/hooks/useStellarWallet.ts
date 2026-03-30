"use client";

import { useState, useCallback, useEffect } from "react";
import { StellarNetwork, StellarWalletState, WalletProvider } from "@/types/stellar";
import { connectFreighter, getFreighterAddress, isFreighterConnected } from "@/lib/stellar/wallet/freighter";
import { connectAlbedo } from "@/lib/stellar/wallet/albedo";
import { defaultNetwork } from "@/lib/stellar/client";
import { getHorizonServer } from "@/lib/stellar/client";

const WALLET_STORAGE_KEY = "stellar_wallet_connection";

interface PersistedWallet {
  address: string;
  provider: WalletProvider;
  network: StellarNetwork;
}

export function useStellarWallet() {
  const [state, setState] = useState<StellarWalletState>({
    address: null,
    provider: null,
    network: defaultNetwork,
    connected: false,
    connecting: false,
    error: null,
  });

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
              setState((s) => ({
                ...s,
                address: persisted.address,
                provider: persisted.provider,
                network: persisted.network,
                connected: true,
              }));
              return;
            }
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
    if (!state.address) {
      setBalances([]);
      return;
    }
    fetchBalances(state.address, state.network);
  }, [state.address, state.network]);

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
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      let address: string;

      switch (provider) {
        case "freighter":
          address = await connectFreighter();
          break;
        case "albedo":
          address = await connectAlbedo();
          break;
        default:
          throw new Error(`Provider "${provider}" is not yet supported`);
      }

      const persisted: PersistedWallet = {
        address,
        provider,
        network: defaultNetwork,
      };
      sessionStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(persisted));

      setState((s) => ({
        ...s,
        address,
        provider,
        connected: true,
        connecting: false,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setState((s) => ({ ...s, connecting: false, error: message }));
    }
  }, []);

  const disconnect = useCallback(() => {
    sessionStorage.removeItem(WALLET_STORAGE_KEY);
    setState({
      address: null,
      provider: null,
      network: defaultNetwork,
      connected: false,
      connecting: false,
      error: null,
    });
    setBalances([]);
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    ...state,
    balances,
    connect,
    disconnect,
    clearError,
    refetchBalances: () =>
      state.address ? fetchBalances(state.address, state.network) : undefined,
  };
}