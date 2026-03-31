"use client";

import { useState, useCallback } from "react";
import { StellarNetwork, WalletProvider } from "@/types/stellar";
import { signWithFreighter } from "@/lib/stellar/wallet/freighter";
import { signWithAlbedo } from "@/lib/stellar/wallet/albedo";
import { getSorobanServer, defaultNetwork, getNetworkPassphrase } from "@/lib/stellar/client";

interface TransactionState {
  signing: boolean;
  submitting: boolean;
  txHash: string | null;
  error: string | null;
}

export function useStellarTransaction(
  provider: WalletProvider | null,
  network: StellarNetwork = defaultNetwork
) {
  const [state, setState] = useState<TransactionState>({
    signing: false,
    submitting: false,
    txHash: null,
    error: null,
  });

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!provider) throw new Error("No wallet connected");
      setState((s) => ({ ...s, signing: true, error: null }));

      try {
        let signedXdr: string;
        if (provider === "freighter") {
          signedXdr = await signWithFreighter(xdr, network);
        } else if (provider === "albedo") {
          signedXdr = await signWithAlbedo(xdr, network);
        } else {
          throw new Error(`Signing with "${provider}" is not supported`);
        }
        setState((s) => ({ ...s, signing: false }));
        return signedXdr;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Signing failed";
        setState((s) => ({ ...s, signing: false, error: message }));
        throw err;
      }
    },
    [provider, network]
  );

  const signAndSubmit = useCallback(
    async (xdr: string): Promise<string> => {
      const signedXdr = await signTransaction(xdr);
      setState((s) => ({ ...s, submitting: true }));

      try {
        const { TransactionBuilder } = await import("@stellar/stellar-sdk");
        const server = getSorobanServer(network);
        const passphrase = getNetworkPassphrase(network);
        const tx = TransactionBuilder.fromXDR(signedXdr, passphrase);

        const result = await server.sendTransaction(tx);

        if (result.status === "ERROR") {
          throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
        }

        setState((s) => ({ ...s, submitting: false, txHash: result.hash }));
        return result.hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed";
        setState((s) => ({ ...s, submitting: false, error: message }));
        throw err;
      }
    },
    [signTransaction, network]
  );

  const clearState = useCallback(() => {
    setState({ signing: false, submitting: false, txHash: null, error: null });
  }, []);

  return { ...state, signTransaction, signAndSubmit, clearState };
}