"use client";

import { OptimizedImage } from './image';
import { Button } from "@/components/ui/button";
import { emitCtaClicked, CTA_IDS, CTA_PLACEMENTS } from "@/lib/telemetry/navigation-instrumentation";
import { Clock, Heart } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useMemo } from 'react';
import { PurchaseModal } from './marketplace/PurchaseModal';
import { MarketplaceFilters } from './marketplace/MarketplaceFilters';
import { useListingsQuery } from '@/hooks/graphql/useListingsQuery';
import { useSearchParams } from 'next/navigation';
import { ListingStatus } from '@/hooks/graphql/generated';

type NFTItem = {
  id: string;
  name: string;
  creator: string;
  price: string;
  likes: number;
  isLive: boolean;
  isFeatured?: boolean;
  bgColor: string;
  image?: string;
  currency: string;
};

export function TodaysPicks() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [selectedNFT, setSelectedNFT] = useState<NFTItem | null>(null);
  
  const search = searchParams.get("search") || "";
  const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const sortBy = searchParams.get("sortBy") || "newest";

  const { data, loading, error, fetchMore } = useListingsQuery({
    variables: {
      pagination: { first: 8 },
      filter: {
        status: ListingStatus.Active,
        search,
        minPrice,
        maxPrice,
        sortBy,
      }
    },
    fetchPolicy: "cache-and-network"
  });

  const listings = data?.listings?.edges.map(e => e.node) || [];
  const pageInfo = data?.listings?.pageInfo;

  const nftItems: NFTItem[] = useMemo(() => {
    return listings.map((listing: any, i) => ({
      id: listing.id,
      name: listing.nft?.name || "Unknown NFT",
      creator: listing.seller?.username || "Unknown",
      price: listing.price,
      currency: listing.currency,
      likes: Math.floor(Math.random() * 50) + 10, // Mock likes for now
      isLive: true,
      bgColor: ["bg-pink-500", "bg-yellow-100", "bg-yellow-300", "bg-green-400", "bg-purple-500", "bg-orange-400", "bg-cyan-400"][i % 7],
      image: listing.nft?.image,
    }));
  }, [listings]);

  return (
    <section className="py-16 relative">
      <MarketplaceFilters />

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#1E1A45] rounded-2xl h-[360px] animate-pulse border border-purple-900/30" />
          ))}
        </div>
      ) : nftItems.length === 0 ? (
        <div className="text-center py-20 bg-[#1E1A45] rounded-2xl border border-purple-900/30">
          <h3 className="text-xl text-gray-300 font-semibold mb-2">No NFTs Found</h3>
          <p className="text-gray-500">Try adjusting your filters or search term</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {nftItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#1E1A45] rounded-2xl overflow-hidden border border-purple-900/30 transition-all hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1"
              >
                <div className="relative">
                  <div className="absolute top-3 left-3 z-10 bg-black/70 rounded-full px-3 py-1 text-xs font-medium">
                    {item.isFeatured ? (
                      <span className="text-yellow-400">
                        {t("todaysPicks.comingSoon")}
                      </span>
                    ) : (
                      <span>{t("todaysPicks.onSale")}</span>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 z-10 bg-black/70 rounded-full px-3 py-1 text-xs font-medium">
                    <Heart className="h-3 w-3 text-red-400 inline mr-1" />
                    <span>{item.likes}</span>
                  </div>
                  <div
                    className={`h-[240px] relative overflow-hidden ${item.bgColor}`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <OptimizedImage
                        src={item.image || "/nftopia-03.svg"}
                        alt={item.name}
                        width={120}
                        height={120}
                        className={item.image ? "w-full h-full object-cover" : "opacity-80"}
                        fallbackSrc="/images/fallbacks/nft-fallback.svg"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg truncate">{item.name}</h3>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-purple-500 overflow-hidden relative flex items-center justify-center text-xs font-bold uppercase">
                        {item.creator.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-300 truncate w-24">{item.creator}</span>
                    </div>
                    <span className="text-sm font-medium text-purple-400 whitespace-nowrap">
                      {item.price} {item.currency}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-purple-900/30">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-purple-400 hover:bg-transparent hover:text-purple-300 rounded-full px-4 py-1 text-xs"
                      onClick={() => setSelectedNFT(item)}
                    >
                      {t("todaysPicks.buyNow") || "Buy Now"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-purple-400 hover:bg-transparent hover:text-purple-300 rounded-full px-4 py-1 text-xs"
                    >
                      {t("todaysPicks.viewHistory")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pageInfo?.hasNextPage && (
            <div className="flex justify-center mt-10">
              <Button
                variant="ghost"
                className="text-purple-400 hover:bg-transparent hover:text-purple-300 rounded-full px-8"
                onClick={() => {
                  fetchMore({
                    variables: {
                      pagination: { first: 8, after: pageInfo.endCursor }
                    }
                  });
                }}
              >
                {t("todaysPicks.loadMore") || "Load More"}
              </Button>
            </div>
          )}
        </>
      )}

      {selectedNFT && (
        <PurchaseModal
          isOpen={!!selectedNFT}
          onClose={() => setSelectedNFT(null)}
          listingId={selectedNFT.id} 
          nftName={selectedNFT.name}
          nftImage={selectedNFT.image || "/nftopia-03.svg"} 
          price={selectedNFT.price}
          currency={selectedNFT.currency}
        />
      )}
    </section>
  );
}
