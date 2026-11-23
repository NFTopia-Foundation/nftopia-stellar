"use client";

import { RefreshCw } from "lucide-react";
import { StellarNetwork } from "@/types/stellar";
import { useWalletBalance } from "@/hooks/useWalletBalance";

interface WalletBalanceProps {
  address: string;
  network: StellarNetwork;
  className?: string;
}

export function WalletBalance({ address, network, className = "" }: WalletBalanceProps) {
  const { balances, loading, error, refresh } = useWalletBalance(address, network);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-purple-300">Balances</span>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="text-gray-400 transition-colors hover:text-purple-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {balances.length === 0 && !loading && !error && (
        <p className="text-xs text-gray-500">No balances found.</p>
      )}

      {balances.map((b) => (
        <div key={b.asset} className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">{b.asset}</span>
          <span className="font-mono text-sm text-gray-300">{parseFloat(b.balance).toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
}
