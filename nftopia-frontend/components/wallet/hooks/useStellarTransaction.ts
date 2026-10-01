"use client";

import { useState, useCallback } from "react";
import { StellarNetwork, WalletProvider } from "@/types/stellar";
import { signWithFreighter } from "@/lib/stellar/wallet/freighter";
import { signWithAlbedo } from "@/lib/stellar/wallet/albedo";
import { signWithWalletConnect } from "@/lib/stellar/wallet/walletconnect";
import { getSorobanServer, defaultNetwork, getNetworkPassphrase } from "@/lib/stellar/client";
import { useTransactionStore } from "@/lib/stores/transaction-store";
import type { TrackedTransactionType } from "@/lib/stores/transaction-store";

interface TransactionState {
  signing: boolean;
  submitting: boolean;
  txHash: string | null;
  error: string | null;
}

export function useStellarTransaction(
  provider: WalletProvider | null,
  network: StellarNetwork = defaultNetwork,
  transactionType: TrackedTransactionType = "other",
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
        } else if (provider === "walletconnect" || provider === "lobstr") {
          signedXdr = await signWithWalletConnect(xdr, network);
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
      let txHash: string | undefined;
      const submittedAt = new Date().toISOString();

      try {
        const { TransactionBuilder } = await import("@stellar/stellar-sdk");
        const server = getSorobanServer(network);
        const passphrase = getNetworkPassphrase(network);
        const tx = TransactionBuilder.fromXDR(signedXdr, passphrase);
        txHash = tx.hash().toString("hex");

        const result = await server.sendTransaction(tx);

        if (result.status === "ERROR") {
          throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
        }

        txHash = result.hash;
        useTransactionStore.getState().addTransaction({
          hash: txHash,
          type: transactionType,
          network,
          status: "processing",
          submittedAt,
          updatedAt: submittedAt,
          signedXdr,
        });
        setState((s) => ({ ...s, submitting: false, txHash: result.hash }));
        return result.hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed";
        if (txHash) {
          const existing = useTransactionStore
            .getState()
            .transactions.find((transaction) => transaction.hash === txHash);
          if (existing) {
            useTransactionStore.getState().updateTransaction(txHash, {
              status: "failed",
              error: message,
              signedXdr,
            });
          } else {
            useTransactionStore.getState().addTransaction({
              hash: txHash,
              type: transactionType,
              network,
              status: "failed",
              submittedAt,
              updatedAt: submittedAt,
              error: message,
              signedXdr,
            });
          }
        }
        setState((s) => ({ ...s, submitting: false, error: message }));
        throw err;
      }
    },
    [signTransaction, network, transactionType]
  );

  const clearState = useCallback(() => {
    setState({ signing: false, submitting: false, txHash: null, error: null });
  }, []);

  return { ...state, signTransaction, signAndSubmit, clearState };
}