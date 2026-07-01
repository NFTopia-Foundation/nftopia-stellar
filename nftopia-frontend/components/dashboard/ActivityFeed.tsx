"use client";

import React from "react";
import Link from "next/link";
import { Package, AlertCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocalizedRoute } from "@/lib/routing";

export interface CreatorActivity {
  id: string;
  action: string;
  amount: string;
  time: Date;
  type: "sale" | "purchase" | "collection" | "mint";
}

interface ActivityFeedProps {
  loading: boolean;
  error?: string;
  recentActivities: CreatorActivity[];
}

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

export function ActivityFeed({
  loading,
  error,
  recentActivities,
}: ActivityFeedProps) {
  const { t } = useTranslation();
  const localizedRoute = useLocalizedRoute();

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 mb-8 backdrop-blur-md">
        <div className="flex justify-between items-center mb-6">
          <div className="text-xl font-bold text-card-foreground">
            {t("creatorDashboard.recentActivity") || "Recent Activity"}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-6 text-center bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
          <span className="text-sm font-semibold text-red-200">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-8 backdrop-blur-md animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div className="text-xl font-bold text-card-foreground">
          {t("creatorDashboard.recentActivity") || "Recent Activity"}
        </div>
        <Link 
          href={localizedRoute("/creator-dashboard/sales")} 
          className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          {t("creatorDashboard.viewAll") || "View All"}
        </Link>
      </div>
      
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/40 animate-pulse">
              <div className="flex items-center space-x-3 w-2/3">
                <div className="w-3.5 h-3.5 rounded-full bg-muted" />
                <div className="space-y-2 w-full">
                  <div className="w-1/2 h-5 bg-muted rounded" />
                  <div className="w-1/4 h-4 bg-muted rounded" />
                </div>
              </div>
              <div className="w-16 h-6 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : recentActivities.length === 0 ? (
        <div className="text-center py-12 bg-muted/10 border border-dashed border-border rounded-xl">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-semibold">No recent activities found.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Start minting NFTs or listing them for sale to populate this feed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recentActivities.map((activity, index) => {
            let displayTime = "";
            try {
              const dateObj = activity.time instanceof Date ? activity.time : new Date(activity.time);
              displayTime = isNaN(dateObj.getTime()) ? "" : formatRelativeTime(dateObj);
            } catch (e) {
              console.error("Failed to format activity time:", e);
            }

            return (
              <div
                key={activity.id}
                className={`flex items-center justify-between p-4 rounded-xl border border-border/40 transition-all duration-300 hover:bg-muted/10 ${
                  index % 2 === 0 ? "bg-card/60" : "bg-background/40"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3.5 h-3.5 rounded-full border border-background/20 ${
                    activity.type === "sale" ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]" :
                    activity.type === "purchase" ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]" :
                    activity.type === "collection" ? "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.4)]" :
                    "bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.4)]"
                  }`} />
                  <div>
                    <div className="text-card-foreground font-semibold text-sm md:text-base">{activity.action}</div>
                    {displayTime && <div className="text-xs text-muted-foreground mt-0.5">{displayTime}</div>}
                  </div>
                </div>
                <div className="text-card-foreground font-bold font-mono text-sm md:text-base bg-muted/30 px-3 py-1 rounded-lg border border-border/20">{activity.amount}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
