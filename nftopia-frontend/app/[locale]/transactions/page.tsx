import { CircuitBackground } from '@/components/circuit-background';
import { TransactionHistoryList } from '@/components/transactions/TransactionHistoryList';
import { Activity } from 'lucide-react';

export default function TransactionsPage() {
  return (
    <main className="min-h-[100svh] relative text-white overflow-hidden">
      <CircuitBackground />

      <div className="relative z-10 max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Activity className="h-5 w-5 text-purple-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Transaction History</h1>
            <p className="text-sm text-gray-500">Track your on-chain activity</p>
          </div>
        </div>

        <TransactionHistoryList />
      </div>
    </main>
  );
}
