import { Horizon } from "@stellar/stellar-sdk";
import { getHorizonServer, defaultNetwork, StellarNetworkKey } from "../client";
import { useEffect, useState, useCallback } from "react";

export const BASE_FEE_STROOPS = 100;
export const STROOPS_PER_XLM = 10_000_000;
export const DEFAULT_XLM_PRICE_USD = 0.12;

export type FeeCongestionLevel = "low" | "medium" | "high";

export interface NetworkFeeEstimate {
  /** Estimated fee in stroops (1 XLM = 10,000,000 stroops) */
  feeStroops: number;
  /** Estimated fee formatted as XLM string (e.g. "0.00001") */
  feeXlm: string;
  /** Estimated fee formatted as fiat string (e.g. "< $0.01" or "$0.000001") */
  fiatEstimate: string;
  /** Estimated base fee in stroops */
  baseFeeStroops: number;
  /** Capacity usage fraction (0.0 to 1.0) */
  ledgerCapacityUsage: number;
  /** Whether the network is experiencing congestion / elevated fees */
  isCongested: boolean;
  /** Congestion severity level */
  congestionLevel: FeeCongestionLevel;
  /** Congestion status message */
  congestionMessage?: string;
  /** Whether the estimate is using offline fallback values */
  isFallback?: boolean;
  /** Raw Horizon fee stats response if available */
  rawStats?: Horizon.HorizonApi.FeeStatsResponse;
}

export interface FeeEstimateOptions {
  network?: StellarNetworkKey;
  operationsCount?: number;
  priority?: "standard" | "priority";
  customXlmPriceUsd?: number;
}

/**
 * Converts stroops to XLM as a formatted decimal string.
 */
export function stroopsToXlm(stroops: number | string): string {
  const numStroops = typeof stroops === "string" ? Number(stroops) : stroops;
  if (isNaN(numStroops) || numStroops < 0) return "0.00001";
  const xlm = numStroops / STROOPS_PER_XLM;
  if (xlm < 0.00001) {
    return xlm.toFixed(7).replace(/\.?0+$/, "");
  }
  return xlm.toFixed(5).replace(/\.?0+$/, "");
}

/**
 * Converts XLM to stroops.
 */
export function xlmToStroops(xlm: number | string): number {
  const numXlm = typeof xlm === "string" ? Number(xlm) : xlm;
  if (isNaN(numXlm) || numXlm < 0) return BASE_FEE_STROOPS;
  return Math.round(numXlm * STROOPS_PER_XLM);
}

/**
 * Formats a fiat estimate given an XLM amount and price per XLM.
 */
export function formatFiatEstimate(
  xlmAmount: number | string,
  xlmPriceUsd: number = DEFAULT_XLM_PRICE_USD
): string {
  const numXlm = typeof xlmAmount === "string" ? Number(xlmAmount) : xlmAmount;
  if (isNaN(numXlm) || numXlm <= 0) return "< $0.01";
  
  const fiat = numXlm * xlmPriceUsd;
  if (fiat < 0.01) {
    return "< $0.01";
  }
  return `$${fiat.toFixed(2)}`;
}

let cachedXlmPrice: { price: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Fetches the current XLM price in USD with in-memory caching.
 * Falls back to default reference rate on failure or non-browser environments.
 */
export async function fetchXlmPriceUsd(): Promise<number> {
  if (cachedXlmPrice && Date.now() - cachedXlmPrice.timestamp < CACHE_TTL_MS) {
    return cachedXlmPrice.price;
  }

  if (typeof window === "undefined" || typeof fetch !== "function") {
    return DEFAULT_XLM_PRICE_USD;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
      { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal }
    ).finally(() => clearTimeout(timeout));

    if (res.ok) {
      const data = await res.json();
      const price = Number(data?.stellar?.usd);
      if (price && !isNaN(price) && price > 0) {
        cachedXlmPrice = { price, timestamp: Date.now() };
        return price;
      }
    }
  } catch {
    // Silent fallback to default rate
  }

  return DEFAULT_XLM_PRICE_USD;
}

/**
 * Evaluates congestion level based on ledger capacity usage and accepted fee mode/min.
 */
export function evaluateCongestion(
  capacityUsage: number,
  modeFee: number,
  baseFee: number = BASE_FEE_STROOPS
): { isCongested: boolean; level: FeeCongestionLevel; message?: string } {
  if (capacityUsage >= 0.85 || modeFee >= 500) {
    return {
      isCongested: true,
      level: "high",
      message: "High network congestion: Elevated surge fee applied for faster confirmation.",
    };
  }

  if (capacityUsage >= 0.7 || modeFee > baseFee) {
    return {
      isCongested: true,
      level: "medium",
      message: "Moderate network traffic: Network fee is slightly elevated.",
    };
  }

  return {
    isCongested: false,
    level: "low",
  };
}

/**
 * Estimates the network fee by querying the Stellar Horizon fee-stats endpoint.
 */
export async function estimateNetworkFee(
  options: FeeEstimateOptions = {}
): Promise<NetworkFeeEstimate> {
  const {
    network = defaultNetwork,
    operationsCount = 1,
    priority = "standard",
    customXlmPriceUsd,
  } = options;

  let feeStroops = BASE_FEE_STROOPS * operationsCount;
  let baseFeeStroops = BASE_FEE_STROOPS;
  let ledgerCapacityUsage = 0;
  let rawStats: Horizon.HorizonApi.FeeStatsResponse | undefined = undefined;
  let isFallback = false;

  try {
    const server = getHorizonServer(network);
    const stats = await server.feeStats();
    rawStats = stats;

    baseFeeStroops = Number(stats.last_ledger_base_fee) || BASE_FEE_STROOPS;
    ledgerCapacityUsage = Number(stats.ledger_capacity_usage) || 0;
    const modeFee = Number(stats.fee_charged?.mode) || Number(stats.max_fee?.mode) || baseFeeStroops;
    const p70Fee = Number(stats.fee_charged?.p70) || Number(stats.max_fee?.p70) || modeFee;
    const p90Fee = Number(stats.fee_charged?.p90) || Number(stats.max_fee?.p90) || p70Fee;

    const { level } = evaluateCongestion(ledgerCapacityUsage, modeFee, baseFeeStroops);

    let perOpFee = baseFeeStroops;
    if (priority === "priority" || level === "high") {
      perOpFee = Math.max(p90Fee, baseFeeStroops);
    } else if (level === "medium") {
      perOpFee = Math.max(p70Fee, modeFee, baseFeeStroops);
    } else {
      perOpFee = Math.max(modeFee, baseFeeStroops);
    }

    feeStroops = perOpFee * Math.max(1, operationsCount);
  } catch (err) {
    // If feeStats endpoint fails or network is offline, fallback to base fee
    isFallback = true;
    feeStroops = BASE_FEE_STROOPS * Math.max(1, operationsCount);
  }

  const { isCongested, level: congestionLevel, message: congestionMessage } = evaluateCongestion(
    ledgerCapacityUsage,
    feeStroops / Math.max(1, operationsCount),
    baseFeeStroops
  );

  const feeXlm = stroopsToXlm(feeStroops);
  const xlmPrice = customXlmPriceUsd ?? (await fetchXlmPriceUsd());
  const fiatEstimate = formatFiatEstimate(feeXlm, xlmPrice);

  return {
    feeStroops,
    feeXlm,
    fiatEstimate,
    baseFeeStroops,
    ledgerCapacityUsage,
    isCongested,
    congestionLevel,
    congestionMessage,
    isFallback,
    rawStats,
  };
}

/**
 * React hook to fetch and monitor Stellar network fees.
 */
export function useNetworkFee(options: FeeEstimateOptions & { refreshInterval?: number } = {}) {
  const { network = defaultNetwork, operationsCount = 1, priority = "standard", refreshInterval = 0 } = options;
  const [feeEstimate, setFeeEstimate] = useState<NetworkFeeEstimate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFee = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const estimate = await estimateNetworkFee({
        network,
        operationsCount,
        priority,
      });
      setFeeEstimate(estimate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to estimate network fee";
      setError(msg);
      setFeeEstimate({
        feeStroops: BASE_FEE_STROOPS * operationsCount,
        feeXlm: stroopsToXlm(BASE_FEE_STROOPS * operationsCount),
        fiatEstimate: "< $0.01",
        baseFeeStroops: BASE_FEE_STROOPS,
        ledgerCapacityUsage: 0,
        isCongested: false,
        congestionLevel: "low",
        isFallback: true,
      });
    } finally {
      setLoading(false);
    }
  }, [network, operationsCount, priority]);

  useEffect(() => {
    fetchFee();
    if (refreshInterval && refreshInterval > 0) {
      const timer = setInterval(fetchFee, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [fetchFee, refreshInterval]);

  return {
    feeEstimate,
    loading,
    error,
    refetch: fetchFee,
  };
}
