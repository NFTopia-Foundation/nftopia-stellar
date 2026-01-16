"use client";

import { useEffect } from "react";
import { Grid3X3, DollarSign, Eye, Users } from "lucide-react";
import { StatCard } from "./components/card-stat";
import { QuickActions } from "./components/quick-actions";
import { DashboardHeader } from "./components/dashboard-header";
import { CollectionsSection } from "./components/collections-section";
import { mockStats } from "./data/mock-data";
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Grid3X3 as React.ComponentType}
            label="NFTs Created"
            value={mockStats.nftsCreated}
            change={12}
            isLoading={loading.userCollections}
          />
          <StatCard
            icon={DollarSign as React.ComponentType}
            label="Total Sales"
            value={mockStats.totalSales}
            change={8}
            isLoading={loading.userCollections}
          />
          <StatCard
            icon={Eye as React.ComponentType}
            label="Total Views"
            value={mockStats.totalViews}
            change={-3}
            isLoading={loading.userCollections}
          />
          <StatCard
            icon={Users as React.ComponentType}
            label="Followers"
            value={mockStats.followers}
            change={15}
            isLoading={loading.userCollections}
          />
        </div>

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
