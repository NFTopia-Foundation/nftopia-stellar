"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  deriveMarketplaceActivity,
  fetchCreatorAuctions,
  fetchCreatorListings,
  type AuctionResponse,
  type ListingResponse,
  type MarketplaceActivity,
} from "@/lib/services/marketplace-service";

function formatStatus(status?: string) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function SalesPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [listings, setListings] = useState<ListingResponse[]>([]);
  const [auctions, setAuctions] = useState<AuctionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user?.sub) {
      setListings([]);
      setAuctions([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadSales() {
      setLoading(true);
      setError(null);

      try {
        const [creatorListings, creatorAuctions] = await Promise.all([
          fetchCreatorListings(user.sub),
          fetchCreatorAuctions(user.sub),
        ]);

        if (!mounted) {
          return;
        }

        setListings(creatorListings);
        setAuctions(creatorAuctions);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load marketplace sales data.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSales();
    return () => {
      mounted = false;
    };
  }, [user?.sub, refreshKey]);

  const summary = useMemo(() => deriveMarketplaceActivity(listings, auctions), [listings, auctions]);

  const activeAuctions = auctions.filter((auction) => auction.status?.toLowerCase() === "active");

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-background">
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("creatorDashboard.salesTitle") || "Sales"}</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              {t("creatorDashboard.salesDescription") || "Track your marketplace listing and auction performance in one place."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="../list-nfts-for-sale"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              {t("creatorDashboard.listForSale") || "List NFTs for Sale"}
            </Link>
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-slate-100 transition"
            >
              {t("creatorDashboard.refresh") || "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-foreground">Loading sales and auction activity...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-semibold">{t("creatorDashboard.errorLoadingSales") || "Unable to load sales data."}</p>
          <p>{error}</p>
          <button
            onClick={() => setRefreshKey((current) => current + 1)}
            className="mt-4 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition"
          >
            {t("creatorDashboard.retry") || "Retry"}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-sm uppercase tracking-wide text-muted-foreground">{t("creatorDashboard.activeListings") || "Active listings"}</div>
              <div className="mt-4 text-4xl font-bold text-foreground">{summary.activeListings.length}</div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-sm uppercase tracking-wide text-muted-foreground">{t("creatorDashboard.itemsSold") || "Items sold"}</div>
              <div className="mt-4 text-4xl font-bold text-foreground">{summary.itemsSold}</div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-sm uppercase tracking-wide text-muted-foreground">{t("creatorDashboard.grossVolume") || "Gross volume"}</div>
              <div className="mt-4 text-4xl font-bold text-foreground">{summary.grossVolume.toFixed(2)} XLM</div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="text-sm uppercase tracking-wide text-muted-foreground">{t("creatorDashboard.activeAuctions") || "Active auctions"}</div>
              <div className="mt-4 text-4xl font-bold text-foreground">{activeAuctions.length}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">{t("creatorDashboard.recentActivity") || "Recent activity"}</h2>
              <span className="text-sm text-muted-foreground">{summary.activities.length} entries</span>
            </div>

            {summary.activities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                {t("creatorDashboard.noSalesActivity") || "No sales or auction events available yet."}
              </div>
            ) : (
              <div className="space-y-4">
                {summary.activities.slice(0, 6).map((activity: MarketplaceActivity) => (
                  <div key={activity.id} className="rounded-2xl border border-border bg-background p-4 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{activity.label}</div>
                      <div className="text-sm text-muted-foreground">{formatStatus(activity.status)} • {new Date(activity.date).toLocaleString()}</div>
                    </div>
                    <div className="mt-3 text-right sm:mt-0">
                      <div className="text-lg font-semibold text-foreground">
                        {activity.amount !== undefined ? `${activity.amount.toFixed(2)} ${activity.currency}` : "—"}
                      </div>
                      <div className="text-sm text-muted-foreground">{activity.type === "auction" ? "Auction" : "Listing"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
