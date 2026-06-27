import { Skeleton } from "@/components/ui/skeleton";

interface CollectionGridSkeletonProps {
  count?: number;
  className?: string;
}

function CollectionCardSkeleton() {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4" aria-hidden="true">
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

export function CollectionGridSkeleton({ count = 3, className }: CollectionGridSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading collections"
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 ${className ?? ""}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CollectionCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading collections...</span>
    </div>
  );
}

export default CollectionGridSkeleton;
