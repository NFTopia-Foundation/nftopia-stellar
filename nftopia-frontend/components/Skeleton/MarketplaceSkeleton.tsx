import { Skeleton } from "@/components/ui/skeleton";

function AuctionCardSkeleton() {
  return (
    <div className="bg-[#1E1A45] rounded-2xl overflow-hidden border border-purple-900/30">
      <Skeleton className="h-[240px] w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-purple-900/30">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function SellerCardSkeleton() {
  return (
    <div className="flex flex-col items-center min-w-[100px]">
      <Skeleton className="w-16 h-16 rounded-2xl mb-3" />
      <Skeleton className="h-4 w-20 mb-1" />
      <Skeleton className="h-3 w-14" />
    </div>
  );
}

function NftCardSkeleton() {
  return (
    <div className="bg-[#1E1A45] rounded-2xl overflow-hidden border border-purple-900/30">
      <Skeleton className="h-[240px] w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-purple-900/30">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function CollectionCardSkeleton() {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4">
      <div className="grid grid-cols-2 grid-rows-2 gap-2 mb-4 aspect-[4/3] overflow-hidden rounded-lg">
        <Skeleton className="col-span-1 row-span-2 rounded-none" />
        <Skeleton className="col-span-1 row-span-1 rounded-none" />
        <Skeleton className="col-span-1 row-span-1 rounded-none" />
      </div>
      <Skeleton className="h-5 w-3/4 mb-2" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    </div>
  );
}

export function MarketplaceSkeleton() {
  return (
    <div
      className="max-w-screen-xl mx-auto px-2 sm:px-4 md:px-8 lg:px-12 pt-12 space-y-16"
      role="status"
      aria-label="Loading marketplace"
      aria-live="polite"
    >
      {/* LiveAuctions skeleton */}
      <section className="py-16 relative" aria-hidden="true">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <AuctionCardSkeleton key={i} />
          ))}
        </div>
        <div className="flex justify-center mt-8 gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-2 w-2 rounded-full" />
          ))}
        </div>
      </section>

      {/* TopSellers skeleton */}
      <section className="py-12 relative" aria-hidden="true">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
        <div className="flex gap-5 overflow-hidden pb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SellerCardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* TodaysPicks skeleton */}
      <section className="py-16 relative" aria-hidden="true">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-8 w-36" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </section>

      {/* PopularCollection skeleton */}
      <section className="py-12 md:py-16 lg:py-20" aria-hidden="true">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <CollectionCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>

      <span className="sr-only">Loading marketplace content...</span>
    </div>
  );
}

export default MarketplaceSkeleton;
