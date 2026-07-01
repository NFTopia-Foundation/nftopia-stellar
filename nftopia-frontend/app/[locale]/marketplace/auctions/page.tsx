"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";
import { CircuitBackground } from "@/components/circuit-background";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ModernSearchInput } from "@/components/ui/modern-search-input";
import { API_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  Clock,
  Gavel,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpDown,
  Filter,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface AuctionNFT {
  id: string;
  name: string;
  image?: string;
  tokenId: string;
  description?: string;
}

interface AuctionBid {
  id: string;
}

interface AuctionSeller {
  id: string;
  username?: string;
  walletAddress?: string;
}

interface AuctionHighestBid {
  id: string;
  amount: string;
  bidderId: string;
  createdAt: string;
}

interface AuctionItem {
  id: string;
  nftId: string;
  sellerId: string;
  startPrice: string;
  currentPrice: string;
  reservePrice?: string;
  startTime: string;
  endTime: string;
  status: string;
  winnerId?: string;
  nft?: AuctionNFT;
  highestBid?: AuctionHighestBid;
  seller?: AuctionSeller;
  bids?: AuctionBid[];
}

interface PaginatedAuctions {
  data: AuctionItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type SortOption = "endingSoonest" | "newlyListed" | "highestBid" | "lowestPrice" | "mostBids";
type CategoryFilter = "all" | "Art" | "Collectibles" | "Gaming" | "Music" | "Photography" | "Virtual Worlds" | "Sports";
type TimeFilter = "all" | "1h" | "6h" | "24h" | "24h+";

// ─── Constants ────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOption; key: string }[] = [
  { value: "endingSoonest", key: "auctions.sort.endingSoonest" },
  { value: "newlyListed", key: "auctions.sort.newlyListed" },
  { value: "highestBid", key: "auctions.sort.highestBid" },
  { value: "lowestPrice", key: "auctions.sort.lowestPrice" },
  { value: "mostBids", key: "auctions.sort.mostBids" },
];

const CATEGORIES: { value: CategoryFilter; key: string }[] = [
  { value: "all", key: "auctions.filters.allCategories" },
  { value: "Art", key: "auctions.filters.art" },
  { value: "Collectibles", key: "auctions.filters.collectibles" },
  { value: "Gaming", key: "auctions.filters.gaming" },
  { value: "Music", key: "auctions.filters.music" },
  { value: "Photography", key: "auctions.filters.photography" },
  { value: "Virtual Worlds", key: "auctions.filters.virtualWorlds" },
  { value: "Sports", key: "auctions.filters.sports" },
];

const TIME_FILTERS: { value: TimeFilter; key: string }[] = [
  { value: "all", key: "auctions.filters.endingWithin" },
  { value: "1h", key: "auctions.filters.oneHour" },
  { value: "6h", key: "auctions.filters.sixHours" },
  { value: "24h", key: "auctions.filters.twentyFourHours" },
  { value: "24h+", key: "auctions.filters.moreThanDay" },
];

const ITEMS_PER_PAGE = 12;

// ─── Helpers ──────────────────────────────────────────────

function getTimeLeft(endTime: string): { total: number; d: number; h: number; m: number; s: number; ended: boolean } {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) {
    return { total: 0, d: 0, h: 0, m: 0, s: 0, ended: true };
  }
  const total = Math.floor(diff / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { total, d, h, m, s, ended: false };
}

function formatAddress(addr?: string): string {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Skeleton Component ───────────────────────────────────

function AuctionCardSkeleton() {
  return (
    <div className="bg-[#1E1A45] rounded-2xl overflow-hidden border border-purple-900/30">
      <Skeleton className="h-[220px] w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-purple-900/30">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function AuctionGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <AuctionCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Auction Card ─────────────────────────────────────────

function AuctionCard({ auction, t }: { auction: AuctionItem; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const timeLeft = useMemo(() => getTimeLeft(auction.endTime), [auction.endTime]);
  const [displayTime, setDisplayTime] = useState(timeLeft);

  useEffect(() => {
    if (timeLeft.ended) return;
    const timer = setInterval(() => {
      setDisplayTime(getTimeLeft(auction.endTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [auction.endTime, timeLeft.ended]);

  const nft = auction.nft;
  const currentPrice = auction.highestBid?.amount || auction.startPrice;
  const bidCount = auction.bids?.length || 0;
  const isEndingSoon = !timeLeft.ended && timeLeft.total < 3600;

  return (
    <Link
      href={`/marketplace/auction/${auction.id}`}
      className="group bg-[#1E1A45] rounded-2xl overflow-hidden border border-purple-900/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1 hover:border-purple-500/40"
    >
      {/* Image */}
      <div className="relative h-[220px] overflow-hidden">
        {nft?.image ? (
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
            <span className="text-5xl opacity-30">🖼️</span>
          </div>
        )}
        {/* Hidden fallback for broken images */}
        {nft?.image && (
          <div className="hidden w-full h-full flex items-center justify-center bg-purple-900/20">
            <span className="text-5xl opacity-30">🖼️</span>
          </div>
        )}

        {/* Time Badge */}
        <div
          className={cn(
            "absolute top-3 right-3 z-10 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md",
            timeLeft.ended
              ? "bg-gray-800/80 text-gray-400"
              : isEndingSoon
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-black/60 text-white"
          )}
        >
          <Clock className={cn("h-3 w-3", isEndingSoon && !timeLeft.ended && "animate-pulse")} />
          <span>
            {timeLeft.ended
              ? t("auctions.card.ended")
              : displayTime.d > 0
                ? `${displayTime.d}d ${displayTime.h}h`
                : displayTime.h > 0
                  ? `${displayTime.h}h ${displayTime.m}m`
                  : `${displayTime.m}m ${displayTime.s}s`}
          </span>
        </div>

        {/* Ending Soon Indicator */}
        {isEndingSoon && !timeLeft.ended && (
          <div className="absolute top-3 left-3 z-10 bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md animate-pulse">
            {t("auctions.card.endingSoon")}
          </div>
        )}

        {/* Status Overlay */}
        {timeLeft.ended && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white/80 font-semibold text-lg uppercase tracking-wider">
              {t("auctions.card.ended")}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
          {nft?.name || "Untitled NFT"}
        </h3>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 truncate max-w-[120px]">
            {auction.seller?.username || formatAddress(auction.seller?.walletAddress)}
          </span>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              {t("auctions.card.currentBid")}
            </p>
            <p className="text-sm font-bold text-purple-400">{currentPrice} XLM</p>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-purple-900/30">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Gavel className="h-3 w-3" />
            <span>{bidCount} {t("auctions.card.bids")}</span>
          </div>
          <span
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
              timeLeft.ended
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            )}
          >
            {timeLeft.ended ? t("auctions.card.viewAuction") : t("auctions.card.placeBid")}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function AuctionsPage() {
  const { t } = useTranslation();

  // State
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("endingSoonest");
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search query to avoid hammering the API
  const debouncedSearch = useDebounce(searchQuery, 400);
  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("status", "ACTIVE");

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      params.set("sortBy", sortBy);

      // Time filter
      if (selectedTimeFilter !== "all") {
        const now = Date.now();
        if (selectedTimeFilter === "24h+") {
          params.set("endAfter", new Date(now + 86400000).toISOString());
        } else {
          const hours = selectedTimeFilter === "1h" ? 1 : selectedTimeFilter === "6h" ? 6 : 24;
          params.set("endBefore", new Date(now + hours * 3600000).toISOString());
        }
      }

      const res = await fetch(`${API_CONFIG.baseUrl}/auctions/active?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch auctions: ${res.statusText}`);
      }
      const data: PaginatedAuctions = await res.json();
      setAuctions(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotalCount(data.meta?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load auctions");
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedCategory, selectedTimeFilter, minPrice, maxPrice, sortBy]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, selectedTimeFilter, minPrice, maxPrice, sortBy]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedTimeFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("endingSoonest");
  }, []);

  const hasActiveFilters =
    searchQuery || selectedCategory !== "all" || selectedTimeFilter !== "all" || minPrice || maxPrice;

  return (
    <main className="min-h-screen relative text-white overflow-hidden">
      <CircuitBackground />

      <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t("auctions.title")}</h1>
              <p className="text-gray-400 mt-1">{t("auctions.subtitle")}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Sort Dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-[#1E1A45] border border-purple-900/30 rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.key)}
                    </option>
                  ))}
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Filter Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "border-purple-900/30 text-gray-300 hover:text-white gap-2",
                  showFilters && "border-purple-500/60 bg-purple-500/10 text-purple-300"
                )}
              >
                <Filter className="h-4 w-4" />
                {t("auctions.filters.title")}
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                )}
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <ModernSearchInput
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder={t("auctions.searchPlaceholder")}
            />
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-8 p-6 bg-[#1E1A45]/80 border border-purple-900/30 rounded-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                {t("auctions.filters.title")}
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  {t("auctions.filters.clearAll")}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  {t("auctions.filters.category")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                        selectedCategory === cat.value
                          ? "bg-purple-500/20 border-purple-500/60 text-purple-300"
                          : "bg-gray-800/40 border-gray-700/40 text-gray-400 hover:text-white hover:border-gray-600"
                      )}
                    >
                      {cat.value === "all" ? t(cat.key) : t(cat.key)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  {t("auctions.filters.priceRange")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder={t("auctions.filters.minPrice")}
                    className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/60"
                    min="0"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder={t("auctions.filters.maxPrice")}
                    className="w-full bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/60"
                    min="0"
                  />
                </div>
              </div>

              {/* Time Remaining */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  {t("auctions.filters.timeRemaining")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIME_FILTERS.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setSelectedTimeFilter(tf.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                        selectedTimeFilter === tf.value
                          ? "bg-purple-500/20 border-purple-500/60 text-purple-300"
                          : "bg-gray-800/40 border-gray-700/40 text-gray-400 hover:text-white hover:border-gray-600"
                      )}
                    >
                      {tf.value === "all" ? t("auctions.filters.endingWithin") : t(tf.key)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <AuctionGridSkeleton />
        ) : error ? (
          <EmptyState
            icon={<div className="text-4xl">⚠️</div>}
            title="Error"
            description={error}
            actionLabel="Retry"
            onAction={fetchAuctions}
          />
        ) : auctions.length === 0 ? (
          <EmptyState
            icon={<div className="text-4xl">🔍</div>}
            title={t("auctions.noResults")}
            description={t("auctions.noResultsDesc")}
            actionLabel={t("auctions.filters.clearAll")}
            onAction={clearFilters}
          />
        ) : (
          <>
            {/* Results count */}
            <p className="text-sm text-gray-400 mb-4">
              {t("auctions.pagination.showing", {
                from: (page - 1) * ITEMS_PER_PAGE + 1,
                to: Math.min(page * ITEMS_PER_PAGE, totalCount),
                total: totalCount,
              })}
            </p>

            {/* Auction Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} t={t} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-12">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="border-purple-900/30 text-gray-300 hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("auctions.pagination.previous")}
                </Button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 7) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - page) <= 1) return true;
                      return false;
                    })
                    .map((p, idx, arr) => (
                      <div key={p} className="flex items-center gap-2">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="text-gray-600">...</span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          className={cn(
                            "w-9 h-9 rounded-lg text-sm font-medium transition-all",
                            page === p
                              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                              : "bg-[#1E1A45] text-gray-400 hover:text-white hover:bg-purple-900/30"
                          )}
                        >
                          {p}
                        </button>
                      </div>
                    ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="border-purple-900/30 text-gray-300 hover:text-white disabled:opacity-40"
                >
                  {t("auctions.pagination.next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
