"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { TrendingUp, Users, DollarSign, Package, AlertCircle, ShoppingBag, Plus } from "lucide-react";
import Link from "next/link";
import { StatsCardsRow } from "@/components/dashboard/StatsCardsRow";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WidgetErrorBoundary } from "@/components/dashboard/WidgetErrorBoundary";
import { useTheme } from "@/lib/stores/preferences-store";
import { useLocalizedRoute } from "@/lib/routing";
import { useExperimentVariant } from '@/hooks/useExperiment';
import { useAuth } from "@/lib/stores/auth-store";
import { API_CONFIG } from "@/lib/config";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { telemetry } from '@/lib/telemetry';
import { sanitizeTelemetryPayload } from '@/lib/telemetry/sanitizer';
import { EVENT_NAMES } from '@/lib/telemetry/events';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export interface CreatorActivity {
  id: string;
  action: string;
  amount: string;
  time: Date;
  type: "sale" | "purchase" | "collection" | "mint";
}

export interface CreatorDashboardViewModel {
  totalNfts: number;
  totalCollections: number;
  totalEarnings: string;
  totalTransactions: number;
  recentActivities: CreatorActivity[];
}

function extractArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (Array.isArray(val.data)) return val.data;
  if (val.data && typeof val.data === "object") {
    return extractArray(val.data);
  }
  if (Array.isArray(val.nfts)) return val.nfts;
  if (Array.isArray(val.collections)) return val.collections;
  if (Array.isArray(val.transactions)) return val.transactions;
  return [];
}

function extractTotal(val: any, fallbackLength: number): number {
  if (!val) return fallbackLength;
  if (typeof val.total === "number") return val.total;
  if (val.data && typeof val.data === "object") {
    return extractTotal(val.data, fallbackLength);
  }
  return fallbackLength;
}

export default function CreatorDashboardPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const localizedRoute = useLocalizedRoute();
  
  const copyAssignment = useExperimentVariant('creator-onboarding-copy-2026-q2');
  const exposureSentRef = useRef(false);
  const exposureSessionIdRef = useRef<string | null>(null);
  const exposureTimestampRef = useRef<number | null>(null);

  const [viewModel, setViewModel] = useState<CreatorDashboardViewModel>({
    totalNfts: 0,
    totalCollections: 0,
    totalEarnings: "0.0000000",
    totalTransactions: 0,
    recentActivities: [],
  });
  
  const [loading, setLoading] = useState({
    stats: true,
    activities: true,
  });
  const [errors, setErrors] = useState({
    stats: "",
    activities: "",
  });

  useEffect(() => {
    if (!copyAssignment || exposureSentRef.current) return;
    const exposureSessionId = crypto.randomUUID();
    exposureSessionIdRef.current = exposureSessionId;
    exposureTimestampRef.current = Date.now();
    telemetry.track(
      EVENT_NAMES.experimentExposed,
      sanitizeTelemetryPayload({
        experiment_id: copyAssignment.experiment_id,
        experiment_name: 'Creator Onboarding Copy Variants',
        variant_id: copyAssignment.variant_id,
        variant_name: copyAssignment.variant_name,
        variant_version: 1,
        surface: 'creator_dashboard_cta',
        placement_category: 'inline_card',
        cta_label: copyAssignment.variant_name,
        assigned_at_timestamp_ms: copyAssignment.assigned_at_timestamp_ms,
        is_control: copyAssignment.is_control,
        target_user_segment: 'creators_only',
        rollout_percentage: 100,
        exposure_session_id: exposureSessionId,
        experiment_session_id: '',
      })
    );
    exposureSentRef.current = true;
  }, [copyAssignment]);

  const handleCreateCollectionClick = () => {
    if (!copyAssignment || !exposureSessionIdRef.current || !exposureTimestampRef.current) return;
    telemetry.track(
      EVENT_NAMES.experimentInteraction,
      sanitizeTelemetryPayload({
        experiment_id: copyAssignment.experiment_id,
        variant_id: copyAssignment.variant_id,
        interaction_type: 'click',
        interaction_timestamp_ms: Date.now(),
        time_to_interaction_ms: Date.now() - exposureTimestampRef.current,
        surface: 'creator_dashboard_cta',
        placement_category: 'inline_card',
        is_control: copyAssignment.is_control,
        exposure_session_id: exposureSessionIdRef.current,
        interaction_sequence: 1,
      })
    );
  };

  const fetchDashboardData = React.useCallback(() => {
    if (!user?.id) return;

    setLoading({ stats: true, activities: true });
    setErrors({ stats: "", activities: "" });

    Promise.allSettled([
      fetchWithAuth(`${API_CONFIG.baseUrl}/collections?creatorId=${user.id}`).then(r => r.json()),
      fetchWithAuth(`${API_CONFIG.baseUrl}/nfts?creatorId=${user.id}`).then(r => r.json()),
      fetchWithAuth(`${API_CONFIG.baseUrl}/users/me/earnings`).then(r => r.json()),
      fetchWithAuth(`${API_CONFIG.baseUrl}/transactions`).then(r => r.json()),
    ]).then(([collectionsRes, nftsRes, earningsRes, txsRes]) => {
      let totalCollections = 0;
      let totalNfts = 0;
      let totalEarnings = "0.0000000";
      let totalTransactions = 0;

      if (collectionsRes.status === "fulfilled") {
        const colVal = collectionsRes.value;
        const colArray = extractArray(colVal);
        totalCollections = extractTotal(colVal, colArray.length);
      }

      if (nftsRes.status === "fulfilled") {
        const nftVal = nftsRes.value;
        const nftArray = extractArray(nftVal);
        totalNfts = extractTotal(nftVal, nftArray.length);
      }

      if (earningsRes.status === "fulfilled") {
        const earnVal = earningsRes.value;
        totalEarnings = earnVal.data?.data?.earnings ?? earnVal.earnings ?? "0.0000000";
      }

      if (txsRes.status === "fulfilled") {
        const txVal = txsRes.value;
        const txArray = extractArray(txVal);
        totalTransactions = txArray.filter((tx: any) => tx.sellerId === user.id && (tx.state === "completed" || tx.state === "COMPLETED")).length;
      }

      const recentActivities: CreatorActivity[] = [];

      if (txsRes.status === "fulfilled") {
        const txVal = txsRes.value;
        const txArray = extractArray(txVal);
        txArray.forEach((tx: any) => {
          if (tx.state === "completed" || tx.state === "COMPLETED") {
            const isSale = tx.sellerId === user.id;
            recentActivities.push({
              id: `tx-${tx.id}`,
              action: isSale ? `NFT #${tx.nftTokenId || 'Unknown'} sold` : `NFT #${tx.nftTokenId || 'Unknown'} purchased`,
              amount: `${parseFloat(tx.amount).toFixed(2)} ${tx.currency || 'STRK'}`,
              time: new Date(Number(tx.completedAt || tx.createdAt) * 1000),
              type: isSale ? "sale" : "purchase",
            });
          }
        });
      }

      if (collectionsRes.status === "fulfilled") {
        const colVal = collectionsRes.value;
        const colArray = extractArray(colVal);
        colArray.forEach((col: any) => {
          recentActivities.push({
            id: `col-${col.id}`,
            action: `New collection created`,
            amount: col.name,
            time: new Date(col.createdAt),
            type: "collection",
          });
        });
      }

      if (nftsRes.status === "fulfilled") {
        const nftVal = nftsRes.value;
        const nftArray = extractArray(nftVal);
        nftArray.forEach((nft: any) => {
          recentActivities.push({
            id: `nft-${nft.id}`,
            action: `NFT #${nft.tokenId} minted`,
            amount: nft.name,
            time: new Date(nft.mintedAt || nft.createdAt),
            type: "mint",
          });
        });
      }

      recentActivities.sort((a, b) => b.time.getTime() - a.time.getTime());

      setViewModel({
        totalNfts,
        totalCollections,
        totalEarnings,
        totalTransactions,
        recentActivities: recentActivities.slice(0, 5),
      });
      setLoading({ stats: false, activities: false });
    }).catch(err => {
      console.error("Error fetching dashboard statistics:", err);
      setErrors({ stats: "Failed to load dashboard statistics.", activities: "Failed to load recent activity feed." });
      setLoading({ stats: false, activities: false });
    });
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="p-6 lg:p-8 bg-background min-h-screen">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("creatorDashboard.title") || "Creator Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            {t("creatorDashboard.subtitle") || "Manage your NFTs and track your earnings"}
          </p>
        </div>
        {user && (
          <div className="flex items-center space-x-3 bg-card border border-border/80 px-4 py-2.5 rounded-xl shadow-sm backdrop-blur-sm">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-9 h-9 rounded-full border border-border object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                {user.username?.slice(0, 2).toUpperCase() || "US"}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-foreground">{user.username || "Creator"}</div>
              <div className="text-xs text-muted-foreground font-mono">{user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}</div>
            </div>
          </div>
        )}
      </div>

      <WidgetErrorBoundary widgetName="stats cards" onRetry={fetchDashboardData}>
        <StatsCardsRow
          loading={loading.stats}
          error={errors.stats}
          totalNfts={viewModel.totalNfts}
          totalCollections={viewModel.totalCollections}
          totalEarnings={viewModel.totalEarnings}
          totalTransactions={viewModel.totalTransactions}
        />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary widgetName="activity feed" onRetry={fetchDashboardData}>
        <ActivityFeed
          loading={loading.activities}
          error={errors.activities}
          recentActivities={viewModel.recentActivities}
        />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary widgetName="quick actions">
        <QuickActions onCreateCollectionClick={handleCreateCollectionClick} />
      </WidgetErrorBoundary>
    </div>
  );
}