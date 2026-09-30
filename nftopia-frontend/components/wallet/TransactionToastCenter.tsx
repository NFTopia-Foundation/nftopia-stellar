"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { getExplorerUrl } from "@/lib/stellar/network";
import { useTransactionStore } from "@/lib/stores/transaction-store";
import { useTransactionTracker } from "@/lib/hooks/useTransactionTracker";

const STATUS_LABELS = {
  pending: "Transaction submitted",
  processing: "Confirming transaction",
  confirmed: "Transaction confirmed",
  failed: "Transaction failed",
} as const;

export function TransactionToastCenter() {
  useTransactionTracker();
  const transactions = useTransactionStore((state) => state.transactions);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  const visible = transactions
    .filter((transaction) => !dismissed.includes(transaction.hash))
    .slice(0, 3);

  if (!visible.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-label="Transaction updates"
    >
      {visible.map((transaction) => {
        const isActive = transaction.status === "pending" || transaction.status === "processing";
        return (
          <section
            key={transaction.hash}
            className="border border-white/15 bg-[#111725] p-4 shadow-xl"
            role={transaction.status === "failed" ? "alert" : "status"}
          >
            <div className="flex items-start gap-3">
              {isActive ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan-300" aria-hidden="true" />
              ) : transaction.status === "confirmed" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {STATUS_LABELS[transaction.status]}
                </p>
                <Link
                  href={getExplorerUrl(transaction.network, transaction.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 truncate font-mono text-xs text-cyan-200 hover:text-cyan-100"
                >
                  {transaction.hash}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </Link>
                {transaction.error && (
                  <p className="mt-2 text-xs text-red-200">{transaction.error}</p>
                )}
                {transaction.status === "failed" && transaction.signedXdr && (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-cyan-200 underline underline-offset-2 disabled:opacity-50"
                    disabled={retrying === transaction.hash}
                    onClick={async () => {
                      setRetrying(transaction.hash);
                      try {
                        const { retryTrackedTransaction } = await import(
                          "@/lib/hooks/useTransactionTracker"
                        );
                        await retryTrackedTransaction(transaction.hash);
                      } catch {
                        // The tracker records and displays the retry error.
                      } finally {
                        setRetrying(null);
                      }
                    }}
                  >
                    {retrying === transaction.hash ? "Resubmitting…" : "Retry submission"}
                  </button>
                )}
              </div>
              <button
                type="button"
                className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center text-slate-400 hover:text-white"
                aria-label="Dismiss transaction update"
                title="Dismiss transaction update"
                onClick={() => setDismissed((current) => [...current, transaction.hash])}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
