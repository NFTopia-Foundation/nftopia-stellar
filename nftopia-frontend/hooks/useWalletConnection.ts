"use client";

import { useEffect, useRef } from "react";
import { useWalletStore } from "@/stores/walletStore";
import { isFreighterConnected, getFreighterAddress } from "@/lib/stellar/wallet/freighter";


export function useWalletConnection() {
  const { address, provider, connected, setConnected, setDisconnected } = useWalletStore();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Restore + validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      if (!connected || !address) return;

      if (provider === "freighter") {
        try {
          const stillConnected = await isFreighterConnected();
          if (!stillConnected) {
            setDisconnected();
            return;
          }
          const currentAddress = await getFreighterAddress();
          if (currentAddress !== address) {
            // User switched accounts in the extension
            setConnected(currentAddress, "freighter", useWalletStore.getState().network);
          }
        } catch {
          setDisconnected();
        }
      }
      
    };

    validateSession();
  }, []); 

  // Poll Freighter connection status
  useEffect(() => {
    if (!connected || provider !== "freighter") {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const stillConnected = await isFreighterConnected();
        if (!stillConnected) {
          setDisconnected();
        }
      } catch {
        
      }
    }, 30_000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [connected, provider, setDisconnected]);

  return {
    address,
    provider,
    connected,
    network: useWalletStore.getState().network,
  };
}