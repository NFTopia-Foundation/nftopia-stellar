"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { StellarNetwork } from "@/types/stellar";
import { getHorizonServer } from "@/lib/stellar/client";

interface Balance {
  asset: string;
  balance: string;
  assetCode?: string;
}

interface WalletBalanceProps {
  address: string;
  network: StellarNetwork;
  className?: string;
}

export function WalletBalance({ address, network, className = "" }: WalletBalanceProps) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    setLoading(true);
    setError(null);
    try {
      const server = getHorizonServer(network);
      const account = await server.loadAccount(address);

      const mapped: Balance[] = account.balances.map((b) => {
        if (b.asset_type === "native") {
          return { asset: "XLM", balance: b.balance };
        }
        const code = (b as any).asset_code;
        return {
          asset: code,
          balance: b.balance,
          assetCode: code,
        };
      });

      setBalances(mapped);
    } catch {
      setError("Account not found or unfunded.");
      setBalances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) fetchBalances();
  }, [address, network]);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-purple-300 uppercase tracking-wider">Balances</span>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="text-gray-400 hover:text-purple-300 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {balances.length === 0 && !loading && !error && (
        <p className="text-xs text-gray-500">No balances found.</p>
      )}

      {balances.map((b) => (
        <div key={b.asset} className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">{b.asset}</span>
          <span className="text-sm text-gray-300 font-mono">
            {parseFloat(b.balance).toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  );
}