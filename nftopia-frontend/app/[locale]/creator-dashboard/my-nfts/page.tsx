"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { API_CONFIG } from "@/lib/config";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Layers } from "lucide-react";

interface NFTResponseItem {
  id: string;
  name?: string;
  title?: string;
  tokenId?: string;
  imageUrl?: string;
  image?: string;
  description?: string;
  collectionName?: string;
  collection?: {
    name: string;
  };
}

export default function MyNFTsPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuthStore();

  const [nfts, setNfts] = useState<NFTResponseItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/${locale}/auth/login`);
    }
  }, [isAuthenticated, authLoading, router, locale]);

  const fetchMyNFTs = useCallback(async (targetPage: number) => {
    if (!user?.sub) return;

    setLoading(true);
    setError(null);

    try {
      const url = `${API_CONFIG.baseUrl}/nfts?ownerId=${user.sub}&page=${targetPage}&limit=${limit}`;
      const response = await fetchWithAuth(url, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(t("errors.general") || "Failed to fetch NFTs");
      }

      const result = await response.json();
      
      const rawData = result.data?.data || result.data || result;
      const items: NFTResponseItem[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.nfts)
        ? rawData.nfts
        : [];

      setNfts(items);
      
      const serverHasMore = typeof rawData?.hasMore === "boolean" 
        ? rawData.hasMore 
        : typeof result?.hasMore === "boolean"
        ? result.hasMore
        : items.length === limit;
      
      setHasMore(serverHasMore);
    } catch (err) {
      console.error("Error fetching creator NFTs:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [user?.sub, limit, t]);

  useEffect(() => {
    if (isAuthenticated && user?.sub) {
      fetchMyNFTs(page);
    }
  }, [isAuthenticated, user?.sub, page, fetchMyNFTs]);

  const handleNextPage = () => {
    if (hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const handleRetry = () => {
    fetchMyNFTs(page);
  };

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header section with rich dark mode/vibrant style */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-purple-400">
            {t("profile.myNFTs")}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Manage, showcase, and view your complete collection of minted digital artwork.
          </p>
        </div>
        <div>
          <Button
            onClick={() => router.push(`/${locale}/creator-dashboard/create-your-collection`)}
            className="rounded-full px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/25 transition-all duration-200 hover:scale-[1.02]"
          >
            {t("creator.createNFT")}
          </Button>
        </div>
      </div>

      {/* Main UI States */}
      {loading ? (
        // Loading Skeleton Cards Grid
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" aria-busy="true">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-card/40 border border-border/40 rounded-2xl overflow-hidden h-[380px] flex flex-col space-y-4 p-4 animate-pulse"
            >
              <div className="bg-muted rounded-xl h-[240px] w-full"></div>
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="flex justify-between items-center pt-2">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-4 bg-muted rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        // Error State Card with Retry Action
        <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-4">
          <div className="p-3 bg-red-500/10 rounded-full text-red-400">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-white">Failed to load NFTs</h3>
          <p className="text-sm text-gray-400 max-w-md">{error}</p>
          <Button
            onClick={handleRetry}
            variant="outline"
            className="mt-2 rounded-full border-red-500/30 hover:bg-red-500/10 text-white flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Try Again
          </Button>
        </div>
      ) : nfts.length === 0 ? (
        // Empty State Card
        <div className="bg-card/25 border border-border/30 rounded-2xl py-12">
          <EmptyState
            icon={<Layers size={48} className="text-purple-400/60" />}
            title="No NFTs found"
            description="You don't own any digital assets yet. Connect your wallet or mint a new NFT to get started!"
            actionLabel={t("creator.createNFT")}
            onAction={() => router.push(`/${locale}/creator-dashboard/create-your-collection`)}
          />
        </div>
      ) : (
        // Success Card Grid with Premium Glow and Micro-animations
        <div className="space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {nfts.map((nft) => {
              const nftName = nft.name || nft.title || "Untitled NFT";
              const nftImage = nft.imageUrl || nft.image || "/nftopia-03.svg";
              const tokenId = nft.tokenId || "N/A";
              const collectionName = nft.collectionName || nft.collection?.name;

              return (
                <div
                  key={nft.id}
                  className="group relative bg-[#1E1A45]/30 backdrop-blur-md rounded-2xl overflow-hidden border border-purple-900/30 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 flex flex-col h-[380px]"
                >
                  {/* Card Header/Badge */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="bg-black/60 backdrop-blur-sm border border-white/10 text-white rounded-full px-3 py-1 text-xs font-semibold">
                      ID #{tokenId}
                    </span>
                  </div>

                  {/* Card Image Wrapper with Fallback Placeholder */}
                  <div className="h-[220px] w-full relative bg-purple-950/20 overflow-hidden flex items-center justify-center border-b border-border/30">
                    <Image
                      src={nftImage}
                      alt={nftName}
                      fill
                      sizes="(max-width: 768px) 100vw, 250px"
                      className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      unoptimized={nftImage.endsWith(".svg")}
                    />
                  </div>

                  {/* Card Content details */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      {collectionName && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 tracking-wider uppercase">
                          <Layers size={12} />
                          {collectionName}
                        </div>
                      )}
                      <h3 className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors duration-200 line-clamp-2">
                        {nftName}
                      </h3>
                    </div>

                    <div className="pt-4 border-t border-purple-950/50 flex justify-between items-center">
                      <span className="text-xs text-gray-400">Owner</span>
                      <span className="text-xs font-medium text-white max-w-[120px] truncate">
                        {user?.walletAddress || "Stellar Account"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {(page > 1 || hasMore) && (
            <div className="flex justify-center items-center gap-6 pt-4">
              <Button
                onClick={handlePrevPage}
                disabled={page === 1}
                variant="outline"
                className="rounded-full w-10 h-10 p-0 border-purple-900/30 hover:bg-purple-950/40 text-white disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Previous Page"
              >
                <ChevronLeft size={20} />
              </Button>
              <span className="text-sm font-medium text-white tracking-wider">
                Page {page}
              </span>
              <Button
                onClick={handleNextPage}
                disabled={!hasMore}
                variant="outline"
                className="rounded-full w-10 h-10 p-0 border-purple-900/30 hover:bg-purple-950/40 text-white disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Next Page"
              >
                <ChevronRight size={20} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}