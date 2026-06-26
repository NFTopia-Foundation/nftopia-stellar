'use client';

import { useState, useCallback } from 'react';
import type { ElementType } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Clock,
  Trash2,
  Filter,
} from 'lucide-react';
import {
  useTransactionStore,
  TrackedTransaction,
  TxStatus,
} from '@/lib/stores/transaction-store';
import { useWalletStore } from '@/stores/walletStore';
import { getExplorerUrl } from '@/lib/stellar/network';
import { cn } from '@/lib/utils';
import { TransactionSigner } from '@/components/wallet/TransactionSigner';

const ALL_STATUSES: TxStatus[] = ['pending', 'processing', 'confirmed', 'failed'];

const STATUS_STYLES: Record<TxStatus, string> = {
  pending: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  processing: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  confirmed: 'text-green-400 bg-green-500/10 border-green-500/20',
  failed: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const STATUS_ICONS: Record<TxStatus, ElementType> = {
  pending: Loader2,
  processing: Loader2,
  confirmed: CheckCircle2,
  failed: AlertCircle,
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function TransactionRow({ tx }: { tx: TrackedTransaction }) {
  const { network } = useWalletStore();
  const [retryOpen, setRetryOpen] = useState(false);
  const explorerUrl = getExplorerUrl(network, tx.txHash);
  const Icon = STATUS_ICONS[tx.status];
  const isLoading = tx.status === 'pending' || tx.status === 'processing';

  return (
    <>
      <div className="flex items-center gap-4 p-4 rounded-xl border border-purple-500/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
        {/* Status icon */}
        <div className={cn('flex-shrink-0 rounded-full p-2 border', STATUS_STYLES[tx.status])}>
          <Icon className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white capitalize">{tx.type}</span>
            <span
              className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide',
                STATUS_STYLES[tx.status]
              )}
            >
              {tx.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500 truncate">
              {tx.txHash.slice(0, 8)}…{tx.txHash.slice(-6)}
            </span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-purple-400 transition-colors flex-shrink-0"
              aria-label="View on Stellar Explorer"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
          {tx.status === 'failed' && tx.errorMessage && (
            <p className="text-xs text-red-400/80 mt-1 line-clamp-2">{tx.errorMessage}</p>
          )}
        </div>

        {/* Timestamp + actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[11px] text-gray-600 flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatRelativeTime(tx.createdAt)}
          </span>
          {tx.status === 'failed' && tx.xdr && (
            <button
              onClick={() => setRetryOpen(true)}
              className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Retry modal */}
      {tx.xdr && (
        <TransactionSigner
          open={retryOpen}
          onClose={() => setRetryOpen(false)}
          transactionXdr={tx.xdr}
          type={tx.type}
          description={tx.description}
        />
      )}
    </>
  );
}

export function TransactionHistoryList() {
  const { transactions, clearAll } = useTransactionStore();
  const [filter, setFilter] = useState<TxStatus | 'all'>('all');

  const filtered =
    filter === 'all' ? transactions : transactions.filter((t) => t.status === filter);

  const counts = ALL_STATUSES.reduce(
    (acc, s) => {
      acc[s] = transactions.filter((t) => t.status === s).length;
      return acc;
    },
    {} as Record<TxStatus, number>
  );

  const handleClearAll = useCallback(() => {
    if (confirm('Clear all transaction history?')) clearAll();
  }, [clearAll]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
        {(['all', ...ALL_STATUSES] as const).map((s) => {
          const count = s === 'all' ? transactions.length : counts[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize',
                filter === s
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'bg-white/[0.03] border-purple-500/20 text-gray-400 hover:border-purple-500/40'
              )}
            >
              {s} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}

        {transactions.length > 0 && (
          <button
            onClick={handleClearAll}
            className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-600">
          <Clock className="h-10 w-10 mb-3 opacity-30" aria-hidden="true" />
          <p className="text-sm">No transactions{filter !== 'all' ? ` with status "${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </div>
      )}
    </div>
  );
}
