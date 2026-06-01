"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useToast } from "@/lib/stores";
import { useLocalizedRoute } from "@/lib/routing";
import { useRouter } from "next/navigation";
import { API_CONFIG } from "@/lib/config";
import {
  fetchActiveAuctions,
  fetchActiveListings,
} from "@/lib/marketplace/creatorMarketplaceApi";
import { mapSalesViewModel } from "@/lib/marketplace/creatorMarketplaceMapper";
import type { CreatorSaleActivity } from "@/lib/marketplace/creatorMarketplaceTypes";

function ActivityRow({ activity }: { activity: CreatorSaleActivity }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border bg-card">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {activity.type === "listing" ? "Listing" : "Auction"}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {activity.nftId ?? "Unknown NFT"}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {activity.createdAt
            ? new Date(activity.createdAt).toLocaleString()
            : ""}
        </div>
      </div>

      <div className="text-right">
        <div
          className={`text-xs font-semibold px-3 py-1 rounded-full inline-flex border ${
            activity.status === "active"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : activity.status === "sold"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : activity.status === "cancelled"
                  ? "border-border bg-card text-muted-foreground"
                  : "border-border bg-card text-muted-foreground"
          }`}
        >
          {activity.status}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {activity.price !== undefined && activity.price !== null
            ? `Price: ${activity.price} ${activity.currency ?? ""}`.trim()
            : ""}
        </div>
      </div>
    </div>
  );
}

export default function SalesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const localizedRoute = useLocalizedRoute();
  const { showError, showSuccess } = useToast();
  const { user, isAuthenticated } = useAuthStore();

  const ownerId = user?.sub;

  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [recentActivity, setRecentActivity] = useState<CreatorSaleActivity[]>([]);
  const [summary, setSummary] = useState<{
    activeListingsCount: number;
    itemsSoldCount: number;
    grossVolume: number;
    currency?: string | null;
  } | null>(null);

  const refresh = async () => {
    if (!ownerId) return;

    setLoading(true);
    setGlobalError(null);

    try {
      // Backend contract for creator activity is assumed to be already scoped to creator
      // (e.g., via JWT). If backend returns global results, filter in this layer.
      const [activeListings, activeAuctions] = await Promise.all([
        fetchActiveListings(),
        fetchActiveAuctions(),
      ]);

      const vm = mapSalesViewModel({
        activeListings,
        auctions: activeAuctions,
      });

      setSummary(vm.summary);
      setRecentActivity(vm.recentActivity);
    } catch (e: any) {
      const msg = e?.message || t("creator.sales.errors.load") || "Failed to load sales data";
      setGlobalError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(localizedRoute("/auth/login"));
      return;
    }
    if (!ownerId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, ownerId]);

  const title = useMemo(
    () => t("creator.sales.title") || "Sales & Earnings",
    [t],
  );

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-5xl mx-auto py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">
            {t("creator.sales.subtitle") ||
            "Track listing and auction activity for your NFTs."}
          </p>
        </div>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm text-card-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh") || "Refresh"}
        </button>
      </div>

      {globalError && (
        <div className="mt-6 p-3 bg-red-900/40 text-red-300 rounded-lg text-sm border border-red-500/20 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
          <div className="flex-1">{globalError}</div>
        </div>
      )}

      {loading && !summary ? (
        <div className="mt-8 text-muted-foreground">{t("common.loading") || "Loading..."}</div>
      ) : !summary ? (
        <div className="mt-8 p-6 rounded-xl border border-border bg-card text-muted-foreground">
          {t("creator.sales.empty") || "No sales activity found."}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs text-muted-foreground">Active listings</div>
            <div className="text-2xl font-bold text-foreground mt-2">{summary.activeListingsCount}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs text-muted-foreground">Items sold</div>
            <div className="text-2xl font-bold text-foreground mt-2">{summary.itemsSoldCount}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs text-muted-foreground">Gross volume</div>
            <div className="text-2xl font-bold text-foreground mt-2">
              {summary.grossVolume}{" "}
              <span className="text-base font-semibold text-muted-foreground">
                {summary.currency ?? ""}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Derived deterministically from sold listing/auction `price` fields.
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          {t("creator.sales.recentActivity") || "Recent activity"}
        </h2>

        {loading && summary && recentActivity.length === 0 ? (
          <div className="mt-4 text-muted-foreground">{t("common.loading") || "Loading..."}</div>
        ) : recentActivity.length === 0 ? (
          <div className="mt-4 p-4 rounded-xl border border-border bg-card text-muted-foreground">
            {t("creator.sales.noActivity") || "No recent listing or auction activity."}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentActivity.map((activity) => (
              <ActivityRow key={`${activity.type}:${activity.id}`} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

