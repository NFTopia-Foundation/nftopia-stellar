"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Heart, Grid, Layers, ArrowLeft } from "lucide-react";
import { CircuitBackground } from "@/components/circuit-background";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/stores/preferences-store";
import { NFTGrid } from "@/components/nft/NFTGrid";
import CollectionCard from "@/components/CollectionCard";
import { usePopularCollectionsQuery } from "@/hooks/graphql/useCollectionQueries";
import { useNFTByIdQuery } from "@/hooks/graphql/useNFTQueries";
import { Collection } from "@/types";

type TabType = "all" | "nfts" | "collections";

function FavoriteNFT({ id }: { id: string }) {
  const { data, loading } = useNFTByIdQuery({ id }, { fetchPolicy: "cache-and-network" });
  const nft = data?.nft;
  if (loading && !nft) return <div className="h-72 animate-pulse rounded-xl bg-purple-900/20" />;
  if (!nft) return null;
  return <NFTGrid nfts={[{
    id: nft.id,
    name: nft.name,
    description: nft.description || null,
    image: nft.image || "/nftopia-03.svg",
    collectionName: nft.collection?.name || "Collection",
    tokenId: nft.tokenId,
    contractAddress: nft.contractAddress,
    attributes: (nft.attributes || []).map(({ traitType, value, displayType }) => ({
      traitType,
      value,
      displayType: displayType || undefined,
    })),
    ownerId: nft.ownerId,
    creatorId: nft.creator?.id || "",
    collectionId: nft.collectionId || null,
    lastPrice: nft.lastPrice || null,
    mintedAt: new Date(nft.mintedAt),
  }]} />;
}

export default function FavoritesClient() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const { favoriteNFTs, favoriteCollections, isHydrated } = useFavorites();

  // Fetch collections to map favorited IDs
  const { data: collectionsData, loading: collectionsLoading } = usePopularCollectionsQuery({
    variables: { limit: 50 },
    fetchPolicy: "cache-and-network",
  });

  // Fetch marketplace listings to map favorited NFT IDs
  // Filter collections
  const collectionsList: Collection[] = useMemo(() => {
    const rawCollections: Collection[] = collectionsData?.topCollections || [];
    if (!favoriteCollections.length) return [];
    return rawCollections.filter((c) => favoriteCollections.includes(String(c.id)));
  }, [collectionsData, favoriteCollections]);

  // Filter NFTs
  const totalCount = favoriteNFTs.length + favoriteCollections.length;
  const loading = !isHydrated || collectionsLoading;

  return (
    <main className="min-h-screen relative text-white overflow-hidden pb-20">
      <CircuitBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-purple-900/30 pb-6">
          <div className="space-y-1">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Marketplace</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Heart className="h-6 w-6 fill-purple-400/20" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Your Favorites</h1>
                <p className="text-sm text-gray-400">
                  {totalCount} saved item{totalCount === 1 ? "" : "s"} in your preferences
                </p>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center bg-gray-900/60 p-1 rounded-xl border border-purple-900/30 self-start md:self-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "all"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Grid className="h-4 w-4" />
              <span>All ({totalCount})</span>
            </button>
            <button
              onClick={() => setActiveTab("nfts")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "nfts"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>NFTs ({favoriteNFTs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("collections")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "collections"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Collections ({favoriteCollections.length})</span>
            </button>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mb-4" />
            <p>Loading your saved favorites...</p>
          </div>
        ) : totalCount === 0 ? (
          /* Empty State for zero overall favorites */
          <div className="py-16">
            <EmptyState
              icon={<Heart className="h-12 w-12 text-purple-400 fill-purple-400/20" />}
              title="No Favorites Saved Yet"
              description="Browse the marketplace and click the heart button on any NFT or collection to save it to your favorites."
              actionLabel="Explore Marketplace"
              onAction={() => (window.location.href = "/marketplace")}
            />
          </div>
        ) : (
          <div className="space-y-12">
            {/* NFTs Section */}
            {(activeTab === "all" || activeTab === "nfts") && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <span>Saved NFTs</span>
                    <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                      {favoriteNFTs.length}
                    </span>
                  </h2>
                </div>

                {favoriteNFTs.length === 0 ? (
                  <div className="p-8 text-center bg-gray-900/30 rounded-xl border border-gray-800/50 text-gray-400">
                    No NFTs favorited yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {favoriteNFTs.map((id) => <FavoriteNFT key={id} id={id} />)}
                  </div>
                )}
              </section>
            )}

            {/* Collections Section */}
            {(activeTab === "all" || activeTab === "collections") && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <span>Saved Collections</span>
                    <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                      {favoriteCollections.length}
                    </span>
                  </h2>
                </div>

                {favoriteCollections.length === 0 ? (
                  <div className="p-8 text-center bg-gray-900/30 rounded-xl border border-gray-800/50 text-gray-400">
                    No collections favorited yet.
                  </div>
                ) : collectionsList.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favoriteCollections.map((colId) => (
                      <div
                        key={colId}
                        className="p-6 rounded-xl bg-purple-900/10 border border-purple-900/30 flex items-center justify-between text-white"
                      >
                        <span className="font-medium">Collection #{colId}</span>
                        <Link href={`/collection/${colId}`} className="text-xs text-purple-400 hover:underline">
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {collectionsList.map((col) => (
                      <CollectionCard key={col.id} collection={col} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
