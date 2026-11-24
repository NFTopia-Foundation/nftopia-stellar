"use client";

import { useCallback, useEffect, useState } from "react";
import { StellarNetwork } from "@/types/stellar";
import { getHorizonServer } from "@/lib/stellar/client";

export type WalletAssetBalance = {
  asset: string;
  balance: string;
  assetCode?: string;
};

export type UseWalletBalanceResult = {
  balances: WalletAssetBalance[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Native XLM or matching asset code balance as number, or null if unknown. */
  getBalance: (assetCode: string) => number | null;
};

/**
 * Reusable wallet balance fetch for purchase, bid, and offer flows (#755).
 */
export function useWalletBalance(
  address: string | null | undefined,
  network: StellarNetwork = "testnet",
): UseWalletBalanceResult {
  const [balances, setBalances] = useState<WalletAssetBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setBalances([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const server = getHorizonServer(network);
      const account = await server.loadAccount(address);
      const mapped: WalletAssetBalance[] = account.balances.map((b) => {
        if (b.asset_type === "native") {
          return { asset: "XLM", balance: b.balance };
        }
        const code = (b as { asset_code?: string }).asset_code ?? "UNKNOWN";
        return { asset: code, balance: b.balance, assetCode: code };
      });
      setBalances(mapped);
    } catch {
      setError("Account not found or unfunded.");
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getBalance = useCallback(
    (assetCode: string) => {
      const code = assetCode.toUpperCase() === "NATIVE" ? "XLM" : assetCode.toUpperCase();
      const row = balances.find((b) => b.asset.toUpperCase() === code);
      if (!row) return null;
      const n = parseFloat(row.balance);
      return Number.isFinite(n) ? n : null;
    },
    [balances],
  );

  return { balances, loading, error, refresh, getBalance };
}
