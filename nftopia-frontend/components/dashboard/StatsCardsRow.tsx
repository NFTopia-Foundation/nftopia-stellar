"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Package, Users, DollarSign, TrendingUp, AlertCircle } from "lucide-react";

interface StatsCardsRowProps {
  loading: boolean;
  error?: string;
  totalNfts: number;
  totalCollections: number;
  totalEarnings: string;
  totalTransactions: number;
}

export function StatsCardsRow({
  loading,
  error,
  totalNfts,
  totalCollections,
  totalEarnings,
  totalTransactions,
}: StatsCardsRowProps) {
  const { t } = useTranslation();

  // Safeguard: Ensure totalEarnings is a valid numeric string, default to "0" if malformed/undefined
  const safeEarnings = typeof totalEarnings === "string" ? totalEarnings : "0.00";
  const parsedEarnings = parseFloat(safeEarnings);
  const displayEarnings = isNaN(parsedEarnings) ? "0.00" : parsedEarnings.toFixed(2);

  const dashboardCards = [
    {
      label: t("creatorDashboard.totalNFTs") || "Total NFTs",
      value: loading ? "..." : String(totalNfts),
      change: totalNfts > 0 ? "+100%" : "0%",
      icon: Package,
      color: "text-purple-400",
    },
    {
      label: t("creatorDashboard.totalCollections") || "Collections",
      value: loading ? "..." : String(totalCollections),
      change: totalCollections > 0 ? "+100%" : "0%",
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: t("creatorDashboard.totalEarnings") || "Total Earnings",
      value: loading ? "..." : `${displayEarnings} STRK`,
      change: parsedEarnings > 0 ? "+100%" : "0%",
      icon: DollarSign,
      color: "text-green-400",
    },
    {
      label: t("creatorDashboard.totalTransactions") || "Total Sales",
      value: loading ? "..." : String(totalTransactions),
      change: totalTransactions > 0 ? "+100%" : "0%",
      icon: TrendingUp,
      color: "text-red-400",
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-red-500/10 border border-red-500/20 rounded-xl mb-8">
        <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
        <span className="text-sm font-semibold text-red-200">{error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card/50 border border-border/80 text-card-foreground rounded-xl p-6 animate-pulse backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-muted" />
              <div className="w-12 h-6 bg-muted rounded-full" />
            </div>
            <div className="w-24 h-8 bg-muted rounded mb-2" />
            <div className="w-16 h-4 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {dashboardCards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.label}
            className="bg-card border border-border text-card-foreground rounded-xl p-6 hover:shadow-lg hover:border-border/100 transition-all duration-300 backdrop-blur-md"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                <IconComponent className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
                {card.change}
              </span>
            </div>
            <div className="text-3xl font-extrabold text-card-foreground mb-1 font-mono tracking-tight">{card.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}
