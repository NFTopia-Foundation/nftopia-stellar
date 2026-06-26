"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { API_CONFIG } from "@/lib/config";
import { WidgetErrorBoundary } from "@/components/dashboard/WidgetErrorBoundary";

interface Collection {
  id: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  bannerImageUrl?: string;
}

interface CollectionsResponse {
  data: Collection[];
  total: number;
  page: number;
  limit: number;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  const [retryTrigger, setRetryTrigger] = useState(0);

  const handleRetry = () => {
    setRetryTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_CONFIG.baseUrl}/collections?page=${page}&limit=${limit}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load collections");
        return res.json();
      })
      .then((result) => {
        if (cancelled) return;
        // Handle both wrapped and unwrapped response shapes
        const body: CollectionsResponse = result.data ?? result;
        const items: Collection[] = Array.isArray(body) ? body : (body.data ?? []);
        setCollections(items);
        const total = body.total ?? items.length;
        setHasMore(page * limit < total);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, retryTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-nftopia-text mb-4">Collections</h1>
          <p className="text-nftopia-subtext text-lg">No collections yet. Create your first one!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <h1 className="text-3xl font-bold text-nftopia-text mb-8">Collections</h1>

      <WidgetErrorBoundary widgetName="collections grid" onRetry={handleRetry}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {collections.map((col) => (
            <div
              key={col.id}
              className="rounded-xl border border-nftopia-border bg-nftopia-card overflow-hidden hover:border-purple-500/50 transition-colors"
            >
              {/* Banner / Image */}
              <div className="relative h-32 bg-gradient-to-br from-purple-900/40 to-blue-900/40">
                {(col.bannerImageUrl || col.imageUrl) && (
                  <Image
                    src={col.bannerImageUrl ?? col.imageUrl!}
                    alt={col.name}
                    fill
                    className="object-cover"
                  />
                )}
              </div>

              {/* Collection image avatar */}
              {col.imageUrl && (
                <div className="relative -mt-8 ml-4">
                  <div className="w-16 h-16 rounded-full border-2 border-nftopia-border overflow-hidden bg-nftopia-background">
                    <Image src={col.imageUrl} alt={col.name} width={64} height={64} className="object-cover" />
                  </div>
                </div>
              )}

              <div className="p-4 pt-2">
                <h2 className="text-nftopia-text font-semibold truncate">{col.name}</h2>
                <p className="text-nftopia-subtext text-xs mb-1">{col.symbol}</p>
                {col.description && (
                  <p className="text-nftopia-subtext text-sm line-clamp-2">{col.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </WidgetErrorBoundary>

      {/* Pagination */}
      <div className="flex justify-center gap-4 mt-8">
        {page > 1 && (
          <button
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 rounded-lg border border-purple-500/30 text-white hover:bg-purple-600/20 transition-colors"
          >
            Previous
          </button>
        )}
        {hasMore && (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded-lg border border-purple-500/30 text-white hover:bg-purple-600/20 transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
