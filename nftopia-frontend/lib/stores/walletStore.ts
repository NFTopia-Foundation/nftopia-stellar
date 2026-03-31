import { create } from "zustand";
import { persist } from "zustand/middleware";
import { StellarNetwork, StellarWalletState, WalletProvider } from "@/types/stellar";
import { defaultNetwork } from "@/lib/stellar/client";

interface WalletStore extends StellarWalletState {
  setConnected: (address: string, provider: WalletProvider, network: StellarNetwork) => void;
  setDisconnected: () => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  setNetwork: (network: StellarNetwork) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      address: null,
      provider: null,
      network: defaultNetwork,
      connected: false,
      connecting: false,
      error: null,

      setConnected: (address, provider, network) =>
        set({ address, provider, network, connected: true, connecting: false, error: null }),

      setDisconnected: () =>
        set({
          address: null,
          provider: null,
          connected: false,
          connecting: false,
          error: null,
        }),

      setConnecting: (connecting) => set({ connecting }),

      setError: (error) => set({ error, connecting: false }),

      setNetwork: (network) => set({ network }),
    }),
    {
      name: "stellar-wallet-store",
      // Only persist non-sensitive state
      partialize: (state) => ({
        address: state.address,
        provider: state.provider,
        network: state.network,
        connected: state.connected,
      }),
    }
  )
);