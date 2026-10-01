"use client";

import { useEffect } from "react";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { getNetworkPassphrase, getSorobanServer } from "@/lib/stellar/client";
import { useTransactionStore } from "@/lib/stores/transaction-store";

const POLL_INTERVAL_MS = 10_000;
const TRACKING_TIMEOUT_MS = 2 * 60_000;

export function useTransactionTracker() {
  const activeHashes = useTransactionStore((state) =>
    state.transactions
      .filter((transaction) =>
        transaction.status === "pending" || transaction.status === "processing",
      )
      .map((transaction) => transaction.hash)
      .join(","),
  );

  useEffect(() => {
    if (!activeHashes) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const hashes = new Set(activeHashes.split(","));

    const poll = async () => {
      const transactions = useTransactionStore
        .getState()
        .transactions.filter(
          (transaction) =>
            hashes.has(transaction.hash) &&
            (transaction.status === "pending" || transaction.status === "processing"),
        );

      await Promise.all(
        transactions.map(async (transaction) => {
          if (Date.now() - new Date(transaction.submittedAt).getTime() >= TRACKING_TIMEOUT_MS) {
            useTransactionStore.getState().updateTransaction(transaction.hash, {
              status: "failed",
              error: "Confirmation timed out. Check the explorer or start the action again.",
            });
            return;
          }

          try {
            const result = await getSorobanServer(transaction.network).getTransaction(
              transaction.hash,
            );
            if (result.status === "SUCCESS") {
              useTransactionStore.getState().updateTransaction(transaction.hash, {
                status: "confirmed",
                error: undefined,
              });
            } else if (result.status === "FAILED") {
              useTransactionStore.getState().updateTransaction(transaction.hash, {
                status: "failed",
                error: "The ledger rejected this transaction. Review the transaction and retry.",
              });
            } else {
              useTransactionStore.getState().updateTransaction(transaction.hash, {
                status: "processing",
              });
            }
          } catch {
            useTransactionStore.getState().updateTransaction(transaction.hash, {
              status: "processing",
            });
          }
        }),
      );

      if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [activeHashes]);
}

export async function retryTrackedTransaction(hash: string): Promise<void> {
  const transaction = useTransactionStore
    .getState()
    .transactions.find((item) => item.hash === hash);
  if (!transaction?.signedXdr) {
    throw new Error("This transaction cannot be resubmitted. Start the action again.");
  }

  useTransactionStore.getState().updateTransaction(hash, {
    status: "pending",
    error: undefined,
  });

  try {
    const server = getSorobanServer(transaction.network);
    const tx = TransactionBuilder.fromXDR(
      transaction.signedXdr,
      getNetworkPassphrase(transaction.network),
    );
    const result = await server.sendTransaction(tx);
    if (result.status === "ERROR") {
      throw new Error("The network rejected the resubmission. Start the action again.");
    }
    useTransactionStore.getState().updateTransaction(hash, {
      status: "processing",
      error: undefined,
    });
  } catch (error) {
    useTransactionStore.getState().updateTransaction(hash, {
      status: "failed",
      error: error instanceof Error ? error.message : "Resubmission failed.",
    });
    throw error;
  }
}
