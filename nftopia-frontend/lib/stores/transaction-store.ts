import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { TransactionType } from '@/components/wallet/TransactionSigner';

export type TxStatus = 'pending' | 'processing' | 'confirmed' | 'failed';

export interface TrackedTransaction {
  id: string;          // same as txHash, used as unique key
  txHash: string;
  type: TransactionType;
  description?: string;
  status: TxStatus;
  network: string;
  createdAt: number;   // Date.now()
  updatedAt: number;
  errorMessage?: string;
  /** Original XDR stored for retry capability */
  xdr?: string;
}

interface TransactionStoreState {
  transactions: TrackedTransaction[];
}

interface TransactionStoreActions {
  addTransaction: (tx: Omit<TrackedTransaction, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStatus: (txHash: string, status: TxStatus, errorMessage?: string) => void;
  removeTransaction: (txHash: string) => void;
  clearAll: () => void;
  getPendingCount: () => number;
}

export type TransactionStore = TransactionStoreState & TransactionStoreActions;

export const useTransactionStore = create<TransactionStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        transactions: [],

        addTransaction: (tx) =>
          set((state) => {
            const now = Date.now();
            // Avoid duplicate entries for the same hash
            if (state.transactions.find((t) => t.txHash === tx.txHash)) return;
            state.transactions.unshift({
              ...tx,
              id: tx.txHash,
              createdAt: now,
              updatedAt: now,
            });
            // Keep at most 50 transactions in history
            if (state.transactions.length > 50) {
              state.transactions = state.transactions.slice(0, 50);
            }
          }),

        updateStatus: (txHash, status, errorMessage) =>
          set((state) => {
            const tx = state.transactions.find((t) => t.txHash === txHash);
            if (!tx) return;
            tx.status = status;
            tx.updatedAt = Date.now();
            if (errorMessage !== undefined) tx.errorMessage = errorMessage;
          }),

        removeTransaction: (txHash) =>
          set((state) => {
            state.transactions = state.transactions.filter((t) => t.txHash !== txHash);
          }),

        clearAll: () =>
          set((state) => {
            state.transactions = [];
          }),

        getPendingCount: () => {
          return get().transactions.filter(
            (t) => t.status === 'pending' || t.status === 'processing'
          ).length;
        },
      })),
      {
        name: 'nftopia-transaction-history',
        // Persist only the transactions array
        partialize: (state) => ({ transactions: state.transactions }),
      }
    ),
    { name: 'TransactionStore' }
  )
);
