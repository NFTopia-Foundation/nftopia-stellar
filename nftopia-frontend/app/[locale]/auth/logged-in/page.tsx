"use client";

import { useEffect } from "react";
import { StatCard } from "./components/card-stat";
import { QuickActions } from "./components/quick-actions";
import { DashboardHeader } from "./components/dashboard-header";
import { CollectionsSection } from "./components/collections-section";
import { DashboardStatsCards } from "./components/dashboard-stats";
import { useCollections, useAuth } from "@/lib/stores";

export default function CreatorDashboard() {
  const { userCollections, loading, fetchUserCollections } = useCollections();
  const { isAuthenticated } = useAuth();

  // Fetch user collections when component mounts
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserCollections();
    }
  }, [isAuthenticated, fetchUserCollections]);

  return (
    <div className="min-h-[100svh] bg-nftopia-background">
      {/* Header */}
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <DashboardStatsCards />

        {/* Quick Actions */}
        <div className="mb-8">
          <QuickActions />
        </div>

        {/* Collections Grid */}
        <CollectionsSection
          collections={userCollections}
          isLoading={loading.userCollections}
        />
      </div>
    </div>
  );
}
