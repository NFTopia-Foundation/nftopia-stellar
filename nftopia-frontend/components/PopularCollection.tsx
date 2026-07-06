"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { emitCtaClicked, CTA_IDS, CTA_PLACEMENTS, normalizeRoute } from "@/lib/telemetry/navigation-instrumentation";
import CollectionCard from "./CollectionCard";
import { Collection } from "@/types";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePopularCollectionsQuery } from "@/hooks/graphql/useCollectionQueries";
import { Button } from "./ui/button";
import ErrorBoundary from "./ErrorBoundary";

interface PopularCollectionProps {
  title?: string;
}

const PopularCollection: React.FC<PopularCollectionProps> = ({ title }) => {
  const { t } = useTranslation();
  const defaultTitle = title || t("popularCollection.title");

  const { data, loading, error, refetch } = usePopularCollectionsQuery({
    variables: { limit: 3 },
    fetchPolicy: "cache-and-network"
  });

  // Data is already transformed by the hook
  const collections: Collection[] = data?.topCollections || [];

  function handleExploreMoreClick(e: React.MouseEvent) {
    emitCtaClicked({
      cta_id: CTA_IDS.EXPLORE_MORE_POPULAR_COLLECTION,
      cta_label: "Explore More",
      placement: CTA_PLACEMENTS.LANDING_HERO_PRIMARY,
      destination: normalizeRoute("/explore"),
      // Required fields - using correct types
      destination_route: "/explore",
      interaction_type: "link", // Valid value from CTAInteractionType
      ui_variant: "text" // Valid value from CTAUiVariant
    });
    // Note: Link handles navigation; we are just tracking the click
  }

  return (
    <section aria-labelledby="popular-collection-heading" className="py-12 md:py-16 lg:py-20 ">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 id="popular-collection-heading" className="text-2xl md:text-3xl font-bold text-white">
            {defaultTitle}
          </h2>
          <Link href="/explore" legacyBehavior>
            <a
              onClick={handleExploreMoreClick}
              className="text-purple-400 hover:text-purple-300 font-medium text-sm md:text-base flex items-center gap-1 transition-colors duration-200"
              aria-label="Explore more collections"
            >
              {t("common.exploreMore") || "Explore More"} <ChevronRight size={16} />
            </a>
          </Link>
        </div>

        {error ? (
          // Error State
          <div className="text-center py-10 bg-[#1E1A45] rounded-xl border border-red-900/30">
            <p className="text-red-400 mb-4">Failed to load popular collections</p>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              className="border-red-900/30 hover:bg-red-900/20 text-red-300"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : loading && !data ? (
          // Loading Skeleton
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-[#1E1A45] rounded-xl h-[400px] border border-purple-900/30">
                <div className="h-48 bg-purple-900/20 rounded-t-xl mb-4" />
                <div className="px-4 pb-4">
                  <div className="h-6 bg-purple-900/20 rounded-md w-3/4 mb-3" />
                  <div className="h-4 bg-purple-900/20 rounded-md w-1/2 mb-6" />
                  <div className="flex gap-2">
                    <div className="h-16 w-16 bg-purple-900/20 rounded-lg" />
                    <div className="h-16 w-16 bg-purple-900/20 rounded-lg" />
                    <div className="h-16 w-16 bg-purple-900/20 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          // Empty State
          <div className="text-center py-20 bg-[#1E1A45] rounded-2xl border border-purple-900/30">
            <h3 className="text-xl text-gray-300 font-semibold mb-2">No popular collections found</h3>
            <p className="text-gray-400 text-sm">Check back later for new collections</p>
          </div>
        ) : (
          // Success State - Render Collections
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 md:gap-8">
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// Wrap with Error Boundary - this is the ONLY change
// The error boundary catches any rendering errors in the component
// and displays a friendly fallback UI instead of crashing the page
export default function PopularCollectionWithErrorBoundary(props: PopularCollectionProps) {
  return (
    <ErrorBoundary 
      componentName="PopularCollection" 
      showRetry={true}
      showHome={false} // Hide home button since this is a section component
      showReport={true}
      onError={(error, errorInfo) => {
        // Optional: Log to your telemetry service
        console.error('PopularCollection crashed:', error, errorInfo);
      }}
    >
      <PopularCollection {...props} />
    </ErrorBoundary>
  );
}