import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StellarNetwork } from "@/types/stellar";

export type TransactionStatus = "pending" | "processing" | "confirmed" | "failed";
export type TrackedTransactionType = "mint" | "list" | "bid" | "buy" | "cancel" | "other";

export interface TrackedTransaction {
  hash: string;
  type: TrackedTransactionType;
  network: StellarNetwork;
  status: TransactionStatus;
  submittedAt: string;
  updatedAt: string;
  error?: string;
  signedXdr?: string;
}

interface TransactionStore {
  transactions: TrackedTransaction[];
  addTransaction: (transaction: TrackedTransaction) => void;
  updateTransaction: (hash: string, update: Partial<TrackedTransaction>) => void;
  removeTransaction: (hash: string) => void;
}

const MAX_TRANSACTIONS = 100;

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set) => ({
      transactions: [],
      addTransaction: (transaction) =>
        set((state) => ({
          transactions: [
            transaction,
            ...state.transactions.filter((item) => item.hash !== transaction.hash),
          ].slice(0, MAX_TRANSACTIONS),
        })),
      updateTransaction: (hash, update) =>
        set((state) => ({
          transactions: state.transactions.map((transaction) =>
            transaction.hash === hash
              ? { ...transaction, ...update, updatedAt: new Date().toISOString() }
              : transaction,
          ),
        })),
      removeTransaction: (hash) =>
        set((state) => ({
          transactions: state.transactions.filter((transaction) => transaction.hash !== hash),
        })),
    }),
    {
      name: "nftopia-transactions",
      partialize: (state) => ({ transactions: state.transactions }),
    },
  ),
);
