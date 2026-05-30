"use client";

import React from "react";
import Link from "next/link";
import { emitCtaClicked, CTA_IDS, CTA_PLACEMENTS, normalizeRoute } from "@/lib/telemetry/navigation-instrumentation";
import CollectionCard from "./CollectionCard";
import { Collection } from "@/types"; // Assuming '@/*' path alias is configured for 'apps/frontend/*'
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// Mock Data - Replace with actual data fetching logic
const mockCollections: Collection[] = [
  {
    id: "1",
    title: "Creative Art Collection",
    creatorName: "Ralph Garraway",
    creatorImage: "/images/placeholder-avatar.png", // Placeholder path
    images: {
      main: "/images/placeholder-main.jpg", // Placeholder path
      secondary1: "/images/placeholder-secondary1.jpg",
      secondary2: "/images/placeholder-secondary2.jpg",
    },
    likes: 142,
  },
  {
    id: "2",
    title: "Colorful Abstract",
    creatorName: "Dianne Ameter",
    creatorImage: "/images/placeholder-avatar.png",
    images: {
      main: "/images/placeholder-main.jpg",
      secondary1: "/images/placeholder-secondary1.jpg",
      secondary2: "/images/placeholder-secondary2.jpg",
    },
    likes: 98,
  },
  {
    id: "3",
    title: "Modern Art Collection",
    creatorName: "Rustic Carpenter",
    creatorImage: "/images/placeholder-avatar.png",
    images: {
      main: "/images/placeholder-main.jpg",
      secondary1: "/images/placeholder-secondary1.jpg",
      secondary2: "/images/placeholder-secondary2.jpg",
    },
    likes: 116,
  },
];

interface PopularCollectionProps {
  // Add any props needed, e.g., to fetch data or customize title
  title?: string;
}

const PopularCollection: React.FC<PopularCollectionProps> = ({ title }) => {
  const { t } = useTranslation();
  const defaultTitle = title || t("popularCollection.title");

  // Handler for Explore More CTA
  function handleExploreMoreClick(e: React.MouseEvent) {
    emitCtaClicked({
      cta_id: CTA_IDS.EXPLORE_MORE_POPULAR_COLLECTION,
      placement: CTA_PLACEMENTS.LANDING_POPULAR_COLLECTION_HEADER,
      destination_route: normalizeRoute("/explore"),
      interaction_type: "link",
      ui_variant: "text",
    }, e.nativeEvent);
  }

  return (
    // Using a semantic section element
    <section
      aria-labelledby="popular-collection-heading"
      className="py-12 md:py-16 lg:py-20 "
    >
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex justify-between items-center mb-8">
          <h2
            id="popular-collection-heading"
            className="text-2xl md:text-3xl font-bold text-white"
          >
            {defaultTitle}
          </h2>
          <Link href="/explore" legacyBehavior>
            <a
              className="flex items-center text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0f0f1a] rounded-md px-1 py-0.5"
              onClick={handleExploreMoreClick}
            >
              {t("popularCollection.exploreMore")}
              <ChevronRight size={16} className="ml-1" />
            </a>
          </Link>
        </div>

        {/* Responsive Collection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 md:gap-8">
          {mockCollections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default PopularCollection;
