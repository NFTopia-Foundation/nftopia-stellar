'use client';

import { Loader2 } from 'lucide-react';
import { useTransactionStore } from '@/lib/stores/transaction-store';
import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * Renders a spinning badge with the pending transaction count.
 * Place in the Navbar; hidden when no pending transactions.
 */
export function PendingTransactionBadge() {
  const transactions = useTransactionStore((s) => s.transactions);
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';

  const pendingCount = transactions.filter(
    (t) => t.status === 'pending' || t.status === 'processing'
  ).length;

  if (pendingCount === 0) return null;

  return (
    <Link
      href={`/${locale}/transactions`}
      className="relative flex items-center justify-center h-9 w-9 rounded-full bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
      aria-label={`${pendingCount} pending transaction${pendingCount > 1 ? 's' : ''}`}
    >
      <Loader2 className="h-4 w-4 text-purple-400 animate-spin" aria-hidden="true" />
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-purple-600 text-white text-[10px] font-bold">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </Link>
  );
}
