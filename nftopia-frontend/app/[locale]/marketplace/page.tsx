import { Suspense } from "react";
import { CircuitBackground } from "@/components/circuit-background";
import { LiveAuctions } from "@/components/live-auctions";
import { TopSellers } from "@/components/top-sellers";
import { TodaysPicks } from "@/components/todays-picks";
import PopularCollection from "@/components/PopularCollection";
import { MarketplaceSkeleton } from "@/components/Skeleton/MarketplaceSkeleton";
import { MarketplaceListings } from "@/components/marketplace/MarketplaceListings";

export default function MarketplacePage() {
  return (
    <main className="min-h-[100svh] relative text-white overflow-hidden contain-layout">
      {/* Background */}
      <CircuitBackground />

      {/* Main Content */}
      <div className="relative z-10 max-w-screen-xl mx-auto px-2 sm:px-4 md:px-8 lg:px-12 pt-12 space-y-16">
        <Suspense fallback={<MarketplaceSkeleton />}>
          <LiveAuctions />
          <TopSellers />
          <TodaysPicks />
          <PopularCollection />

          {/* Cursor-paginated catalogue: infinite scroll plus a "Load more"
              fallback, with the current cursor mirrored into the URL. */}
          <section aria-labelledby="all-listings-heading" className="space-y-6">
            <h2 id="all-listings-heading" className="text-2xl font-bold">
              All listings
            </h2>
            <MarketplaceListings />
          </section>
        </Suspense>
      </div>
    </main>
  );
}
