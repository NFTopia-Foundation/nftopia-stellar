"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/stores/walletStore";
import { isFreighterConnected, getFreighterAddress, getFreighterNetwork } from "@/lib/stellar/wallet/freighter";


export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const { connected, provider, address, setConnected, setDisconnected } = useWalletStore();

  // Rehydrate persisted Freighter session on mount 
  useEffect(() => {
    if (!connected || provider !== "freighter") return;

    const rehydrate = async () => {
      try {
        const still = await isFreighterConnected();
        if (!still) { setDisconnected(); return; }

        const currentAddress = await getFreighterAddress();
        const currentNetwork = await getFreighterNetwork();

        if (currentAddress !== address) {
          setConnected(currentAddress, "freighter", currentNetwork);
        }
      } catch {
        setDisconnected();
      }
    };

    rehydrate();
 
  }, []); 

  // Listen for Freighter account / network changes 
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onAccountChange = async () => {
      if (provider !== "freighter") return;
      try {
        const newAddress = await getFreighterAddress();
        const newNetwork = await getFreighterNetwork();
        if (newAddress) setConnected(newAddress, "freighter", newNetwork);
        else setDisconnected();
      } catch {
        setDisconnected();
      }
    };

    const onNetworkChange = async () => {
      if (provider !== "freighter" || !address) return;
      try {
        const newNetwork = await getFreighterNetwork();
        setConnected(address, "freighter", newNetwork);
      } catch {
        setDisconnected();
      }
    };

    // Freighter dispatches these custom window events
    window.addEventListener("freighterAccountChanged", onAccountChange);
    window.addEventListener("freighterNetworkChanged", onNetworkChange);

    return () => {
      window.removeEventListener("freighterAccountChanged", onAccountChange);
      window.removeEventListener("freighterNetworkChanged", onNetworkChange);
    };
  }, [provider, address, setConnected, setDisconnected]);

  return <>{children}</>;
}