import { cn } from "@/lib/utils";
import type { NftMarketState } from "@/types/marketplace";

/** Human-readable label + color treatment for each NFT market state. */
const STATE_CONFIG: Record<
  NftMarketState,
  { label: string; className: string }
> = {
  NOT_LISTED: {
    label: "Not listed",
    className: "bg-zinc-500/15 text-zinc-300",
  },
  ACTIVE: {
    label: "Active listing",
    className: "bg-emerald-500/15 text-emerald-400",
  },
  SOLD: { label: "Sold", className: "bg-blue-500/15 text-blue-400" },
  EXPIRED: { label: "Expired", className: "bg-amber-500/15 text-amber-400" },
};

/**
 * A small status pill that communicates an NFT's marketplace state on the
 * "List NFTs for Sale" page. Shared so the same vocabulary is reused everywhere.
 */
export function MarketStateBadge({
  state,
  className,
}: {
  state: NftMarketState;
  className?: string;
}) {
  const config = STATE_CONFIG[state];
  return (
    <span
      data-testid="market-state-badge"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
