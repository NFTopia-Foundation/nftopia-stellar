import { create } from "zustand";
import { persist } from "zustand/middleware";
import { StellarNetwork, StellarWalletState, WalletProvider } from "@/types/stellar";
import { defaultNetwork } from "@/lib/stellar/client";

// Define user type for the store
export interface WalletUser {
  id: string;
  walletAddress: string;
  username?: string;
  email?: string;
  stellarAddress?: string;
}

interface WalletStore extends StellarWalletState {
  // Existing state
  address: string | null;
  provider: WalletProvider | null;
  network: StellarNetwork;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  // New user state
  user: WalletUser | null;
  userId: string | null; // Convenience getter for user ID

  // Existing methods
  setConnected: (address: string, provider: WalletProvider, network: StellarNetwork, user?: WalletUser) => void;
  setDisconnected: () => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  setNetwork: (network: StellarNetwork) => void;
  // New user methods
  setUser: (user: WalletUser | null) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      // Initial state
      address: null,
      provider: null,
      network: defaultNetwork,
      connected: false,
      connecting: false,
      error: null,
      user: null,

      // Computed getter for userId
      get userId() {
        const state = get();
        return state.user?.id || state.address || null;
      },

      setConnected: (address, provider, network, user) =>
        set({
          address,
          provider,
          network,
          connected: true,
          connecting: false,
          error: null,
          user: user || null,
        }),

      setDisconnected: () =>
        set({
          address: null,
          provider: null,
          connected: false,
          connecting: false,
          error: null,
          user: null,
        }),

      setConnecting: (connecting) => set({ connecting }),

      setError: (error) => set({ error, connecting: false }),

      setNetwork: (network) => set({ network }),

      setUser: (user) => set({ user }),
    }),
    {
      name: "stellar-wallet-store",
      // Only persist non-sensitive state
      partialize: (state) => ({
        address: state.address,
        provider: state.provider,
        network: state.network,
        connected: state.connected,
        // Don't persist user to avoid stale data - fetch on each session
      }),
    }
  )
);

// Convenience selectors for common wallet store access
export const useWalletAddress = () => useWalletStore((state) => state.address);
export const useWalletConnected = () => useWalletStore((state) => state.connected);
export const useWalletUser = () => useWalletStore((state) => state.user);
export const useWalletUserId = () => useWalletStore((state) => state.user?.id || state.address);
export const useWalletNetwork = () => useWalletStore((state) => state.network);
export const useWalletError = () => useWalletStore((state) => state.error);
export const useWalletConnecting = () => useWalletStore((state) => state.connecting);