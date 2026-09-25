"use client";

import React, { useEffect } from "react";
import { useNetworkFee, NetworkFeeEstimate, FeeCongestionLevel } from "@/lib/stellar/wallet/fee";
import { StellarNetworkKey } from "@/lib/stellar/client";
import { useWalletStore } from "@/stores/walletStore";
import { Info, AlertTriangle, Zap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TransactionFeePreviewProps {
  /** Optional network override; defaults to current wallet network */
  network?: StellarNetworkKey;
  /** Number of operations in transaction; default is 1 */
  operationsCount?: number;
  /** Whether to show fiat equivalent in USD; default is true */
  showFiat?: boolean;
  /** Display as a compact inline row (ideal for receipt summaries) or detailed card */
  compact?: boolean;
  /** Custom fee in stroops if pre-calculated */
  customFeeStroops?: number;
  /** Callback fired whenever fee estimate updates */
  onFeeCalculated?: (estimate: NetworkFeeEstimate) => void;
  /** Custom additional className */
  className?: string;
  /** Optional custom label */
  label?: string;
}

export function TransactionFeePreview({
  network: propNetwork,
  operationsCount = 1,
  showFiat = true,
  compact = false,
  customFeeStroops,
  onFeeCalculated,
  className,
  label = "Network Fee (Est.)",
}: TransactionFeePreviewProps) {
  const { network: storeNetwork } = useWalletStore();
  const activeNetwork = propNetwork || (storeNetwork as StellarNetworkKey) || "testnet";

  const { feeEstimate, loading, error, refetch } = useNetworkFee({
    network: activeNetwork,
    operationsCount,
  });

  useEffect(() => {
    if (feeEstimate && onFeeCalculated) {
      onFeeCalculated(feeEstimate);
    }
  }, [feeEstimate, onFeeCalculated]);

  const xlmAmount = feeEstimate?.feeXlm || "0.00001";
  const fiatAmount = feeEstimate?.fiatEstimate || "< $0.01";
  const isCongested = feeEstimate?.isCongested || false;
  const congestionLevel: FeeCongestionLevel = feeEstimate?.congestionLevel || "low";
  const congestionMsg = feeEstimate?.congestionMessage;

  if (compact) {
    return (
      <div
        data-testid="transaction-fee-preview"
        className={cn("flex flex-col gap-1 text-sm", className)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-gray-400">
            <span>{label}</span>
            <span
              title="Stellar network fee required to process and validate this transaction on the ledger."
              className="cursor-help text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-right font-mono">
            {loading && !feeEstimate ? (
              <span className="inline-block h-4 w-16 bg-purple-500/20 animate-pulse rounded" />
            ) : (
              <>
                <span data-testid="fee-xlm-amount" className="text-gray-200 font-medium">
                  {xlmAmount} XLM
                </span>
                {showFiat && (
                  <span data-testid="fee-fiat-amount" className="text-xs text-gray-400 font-normal">
                    ({fiatAmount})
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {isCongested && (
          <div
            data-testid="congestion-warning"
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md mt-0.5 animate-in fade-in duration-200",
              congestionLevel === "high"
                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                : "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20"
            )}
          >
            <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">
              {congestionMsg || "Network congested — surge fee applied for prompt execution"}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="transaction-fee-preview"
      className={cn(
        "rounded-xl border border-purple-500/20 bg-purple-950/20 backdrop-blur-sm p-3.5 text-sm space-y-2.5",
        isCongested && (congestionLevel === "high" ? "border-amber-500/30 bg-amber-950/10" : "border-yellow-500/30 bg-yellow-950/10"),
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Zap className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <span className="font-medium text-gray-200 block text-xs uppercase tracking-wider">
              {label}
            </span>
            <span className="text-[11px] text-gray-400">
              Stellar base network validation cost
            </span>
          </div>
        </div>

        <div className="text-right">
          {loading && !feeEstimate ? (
            <div className="h-4 w-20 bg-purple-500/20 animate-pulse rounded ml-auto" />
          ) : (
            <div>
              <span data-testid="fee-xlm-amount" className="font-mono font-semibold text-white block">
                {xlmAmount} XLM
              </span>
              {showFiat && (
                <span data-testid="fee-fiat-amount" className="text-xs text-gray-400">
                  ≈ {fiatAmount} USD
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isCongested && (
        <div
          data-testid="congestion-warning"
          className={cn(
            "flex items-start gap-2 p-2 rounded-lg text-xs",
            congestionLevel === "high"
              ? "bg-amber-500/15 text-amber-200 border border-amber-500/30"
              : "bg-yellow-500/15 text-yellow-200 border border-yellow-500/30"
          )}
        >
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-300">
              {congestionLevel === "high" ? "High Network Congestion" : "Elevated Network Traffic"}
            </p>
            <p className="text-amber-200/80 leading-relaxed">
              {congestionMsg || "Network demand is high. Fee is automatically adjusted to ensure prompt ledger inclusion."}
            </p>
          </div>
        </div>
      )}

      {(feeEstimate?.isFallback || error) && (
        <div className="flex items-center justify-between text-xs text-amber-400/90 pt-1 border-t border-purple-500/10">
          <span>Using standard base fee (network stats unavailable)</span>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 ml-2"
            aria-label="Retry fetching fee"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}
    </div>
  );
}
export default TransactionFeePreview;
