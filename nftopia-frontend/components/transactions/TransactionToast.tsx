'use client';

import { useEffect, useRef } from 'react';
import type { ElementType } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { useTransactionStore, TrackedTransaction, TxStatus } from '@/lib/stores/transaction-store';
import { useTransactionTracker } from '@/lib/hooks/useTransactionTracker';
import { useWalletStore } from '@/stores/walletStore';
import { getExplorerUrl } from '@/lib/stellar/network';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { StellarNetwork } from '@/types/stellar';

const MAX_VISIBLE = 3;

const STATUS_CONFIG: Record<TxStatus, { color: string; icon: ElementType; label: string }> = {
  pending: {
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    icon: Loader2,
    label: 'Submitted',
  },
  processing: {
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    icon: Loader2,
    label: 'Processing',
  },
  confirmed: {
    color: 'bg-green-500/10 border-green-500/30 text-green-300',
    icon: CheckCircle2,
    label: 'Confirmed',
  },
  failed: {
    color: 'bg-red-500/10 border-red-500/30 text-red-300',
    icon: AlertCircle,
    label: 'Failed',
  },
};

function ToastItem({ tx, onDismiss }: { tx: TrackedTransaction; onDismiss: (id: string) => void }) {
  const { network } = useWalletStore();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const { color, icon: Icon, label } = STATUS_CONFIG[tx.status];
  const isLoading = tx.status === 'pending' || tx.status === 'processing';
  const explorerUrl = getExplorerUrl(network, tx.txHash);
  const shortHash = `${tx.txHash.slice(0, 6)}…${tx.txHash.slice(-4)}`;

  // Auto-dismiss confirmed/failed after 8s
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (tx.status === 'confirmed' || tx.status === 'failed') {
      timerRef.current = setTimeout(() => onDismiss(tx.id), 8000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tx.status, tx.id, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-sm shadow-lg max-w-xs w-full animate-in slide-in-from-right-4 duration-300',
        color
      )}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={cn('h-4 w-4 mt-0.5 flex-shrink-0', isLoading && 'animate-spin')}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-semibold">
          {label} · {tx.type}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono opacity-75 truncate">{shortHash}</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 opacity-75 hover:opacity-100"
            aria-label="View on Stellar Explorer"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
        {tx.status === 'failed' && tx.errorMessage && (
          <p className="text-xs opacity-75 line-clamp-2">{tx.errorMessage}</p>
        )}
        {tx.status === 'failed' && tx.xdr && (
          <Link
            href={`/${locale}/transactions`}
            className="inline-flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100 mt-0.5"
          >
            <RefreshCw className="h-2.5 w-2.5" /> Retry in history
          </Link>
        )}
      </div>
      <button
        onClick={() => onDismiss(tx.id)}
        className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Global transaction toast container.
 * Place once in the root layout. It subscribes to the transaction store,
 * starts polling for new pending transactions, and renders live toast cards.
 */
export function TransactionToastContainer() {
  const { transactions, removeTransaction } = useTransactionStore();
  const { trackTransaction } = useTransactionTracker();
  const { network } = useWalletStore();

  // Start tracking any newly-added pending transactions
  const trackedRef = useRef(new Set<string>());
  useEffect(() => {
    transactions
      .filter((tx) => tx.status === 'pending' && !trackedRef.current.has(tx.txHash))
      .forEach((tx) => {
        trackedRef.current.add(tx.txHash);
        trackTransaction(tx.txHash, (tx.network as StellarNetwork) ?? network);
      });
  }, [transactions, trackTransaction, network]);

  // Show most recent MAX_VISIBLE transactions that are not yet dismissed
  const visible = transactions.slice(0, MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-4 z-[200] flex flex-col gap-2 items-end"
      aria-label="Transaction notifications"
    >
      {visible.map((tx) => (
        <ToastItem key={tx.id} tx={tx} onDismiss={removeTransaction} />
      ))}
    </div>
  );
}
