"use client";

import { Activity, DollarSign, ShoppingBag, Tag } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useCreatorSales } from "@/hooks/useCreatorSales";
import { formatAmount, formatDate } from "@/components/marketplace/format";
import type { MarketplaceActivity, SalesSummary } from "@/types/marketplace";

/** A single summary tile (active listings, items sold, gross volume). */
function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex size-11 items-center justify-center rounded-xl bg-nftopia-purple/10 text-nftopia-purple">
          {icon}
        </span>
        <div>
          <p className="text-sm text-nftopia-subtext">{label}</p>
          <p className="text-xl font-bold text-nftopia-text">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Renders the three derived summary tiles from the sales summary model. */
function SummaryTiles({ summary }: { summary: SalesSummary }) {
  return (
    <div
      data-testid="sales-summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <SummaryTile
        icon={<Tag className="size-5" />}
        label="Active listings"
        value={String(summary.activeListings)}
      />
      <SummaryTile
        icon={<ShoppingBag className="size-5" />}
        label="Items sold"
        value={String(summary.itemsSold)}
      />
      <SummaryTile
        icon={<DollarSign className="size-5" />}
        label="Gross volume"
        value={formatAmount(summary.grossVolume, summary.currency)}
      />
    </div>
  );
}

/** A single row in the recent-activity feed. */
function ActivityRow({ item }: { item: MarketplaceActivity }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-nftopia-text">
          {item.kind === "AUCTION" ? "Auction" : "Listing"} · {item.nftKey}
        </p>
        <p className="text-xs text-nftopia-subtext">
          {item.status} · {formatDate(item.timestamp)}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-nftopia-text">
        {formatAmount(item.amount, item.currency)}
      </span>
    </li>
  );
}

/** Skeleton shown while summary + activity load. */
function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

/**
 * "Sales" — the creator's marketplace performance view. Aggregates listings and
 * auctions through the shared mapper into summary tiles and a unified
 * recent-activity feed, so it stays consistent with the List-for-Sale page.
 */
export default function SalesPage() {
  const { summary, activity, loading, error, refetch } = useCreatorSales();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-nftopia-text">Sales &amp; Earnings</h1>
        <p className="text-nftopia-subtext">
          Track your listings, sales, and auction activity.
        </p>
      </header>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Couldn&apos;t load sales data</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-8">
          {summary && <SummaryTiles summary={summary} />}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-nftopia-text">
              Recent activity
            </h2>
            {activity.length === 0 ? (
              <EmptyState
                icon={<Activity className="size-10 text-nftopia-subtext" />}
                title="No marketplace activity yet"
                description="Your listings and auction outcomes will show up here."
              />
            ) : (
              <ul data-testid="activity-feed">
                {activity.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
