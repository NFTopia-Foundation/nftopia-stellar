"use client";

import { DollarSign, Eye, Grid3X3, Users } from "lucide-react";
import { StatCard } from "./card-stat";
import { useDashboardStats, DashboardStats } from "@/hooks/graphql/useDashboardStats";

const formatNumber = (value: number | string | undefined): string => {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat().format(num);
};

export const DashboardStatsCards = () => {
  const { stats, loading, error, refetch } = useDashboardStats();

  const fallback: DashboardStats = {
    nftsCreated: 0,
    totalSales: "0",
    totalViews: 0,
    followers: 0,
  };

  const data: DashboardStats = stats ?? fallback;

  // Convert totalSales to number for the StatCard
  const totalSalesNumber = typeof data.totalSales === "string" 
    ? Number(data.totalSales) 
    : data.totalSales || 0;

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        <p className="font-semibold">Unable to load stats</p>
        <p className="mt-1 text-xs text-red-200/80">{error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        icon={Grid3X3 as React.ComponentType<{ className?: string }>}
        label="NFTs Created"
        value={data.nftsCreated}
        change={0}
        isLoading={loading}
      />
      <StatCard
        icon={DollarSign as React.ComponentType<{ className?: string }>}
        label="Total Sales"
        value={totalSalesNumber}
        change={0}
        isLoading={loading}
      />
      <StatCard
        icon={Eye as React.ComponentType<{ className?: string }>}
        label="Total Views"
        value={data.totalViews}
        change={0}
        isLoading={loading}
      />
      <StatCard
        icon={Users as React.ComponentType<{ className?: string }>}
        label="Followers"
        value={data.followers}
        change={0}
        isLoading={loading}
      />
    </div>
  );
};