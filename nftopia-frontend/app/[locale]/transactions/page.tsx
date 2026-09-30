"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { getExplorerUrl } from "@/lib/stellar/network";
import {
  type TransactionStatus,
  useTransactionStore,
} from "@/lib/stores/transaction-store";
import { retryTrackedTransaction } from "@/lib/hooks/useTransactionTracker";

const FILTERS: Array<{ value: "all" | TransactionStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "failed", label: "Failed" },
];

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  confirmed: "Confirmed",
  failed: "Failed",
};

export default function TransactionsPage() {
  const transactions = useTransactionStore((state) => state.transactions);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [retrying, setRetrying] = useState<string | null>(null);
  const visibleTransactions = transactions.filter((transaction) => {
    if (filter === "all") return true;
    if (filter === "pending") {
      return transaction.status === "pending" || transaction.status === "processing";
    }
    return transaction.status === filter;
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 text-white">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Stellar activity</p>
          <h1 className="mt-2 text-2xl font-semibold">Transactions</h1>
        </div>
        <p className="text-sm text-slate-400">{transactions.length} recent</p>
      </div>

      <div className="mt-5 flex gap-1 border-b border-white/10" role="tablist" aria-label="Filter transactions">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            className={`border-b-2 px-4 py-3 text-sm ${
              filter === item.value
                ? "border-cyan-300 text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleTransactions.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No transactions in this view.</p>
      ) : (
        <ul className="divide-y divide-white/10" aria-label="Transaction history">
          {visibleTransactions.map((transaction) => (
            <li key={transaction.hash} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium capitalize">{transaction.type}</span>
                  <span className={`text-xs ${
                    transaction.status === "confirmed"
                      ? "text-emerald-300"
                      : transaction.status === "failed"
                        ? "text-red-300"
                        : "text-cyan-300"
                  }`}>
                    {STATUS_LABELS[transaction.status]}
                  </span>
                  <span className="text-xs text-slate-500">{transaction.network}</span>
                </div>
                <time className="mt-1 block text-xs text-slate-400" dateTime={transaction.submittedAt}>
                  {new Date(transaction.submittedAt).toLocaleString()}
                </time>
                <Link
                  href={getExplorerUrl(transaction.network, transaction.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-cyan-200 hover:text-cyan-100"
                >
                  <span className="truncate">{transaction.hash}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="sr-only">View on Stellar Expert</span>
                </Link>
                {transaction.error && <p className="mt-1 text-xs text-red-200">{transaction.error}</p>}
              </div>
              {transaction.status === "failed" && transaction.signedXdr && (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-2 border border-white/20 px-3 text-sm text-white hover:border-cyan-300 disabled:opacity-50"
                  disabled={retrying === transaction.hash}
                  onClick={async () => {
                    setRetrying(transaction.hash);
                    try {
                      await retryTrackedTransaction(transaction.hash);
                    } catch {
                      // The transaction tracker stores the error for this row.
                    } finally {
                      setRetrying(null);
                    }
                  }}
                >
                  {retrying === transaction.hash ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Retry
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
