"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function CreatorProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="flex gap-4">
        <Skeleton className="h-24 w-24 rounded-2xl" />
        <div className="flex-1 space-y-3 pt-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}
