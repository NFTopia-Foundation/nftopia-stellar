"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TransferHistorySkeletonProps {
  count?: number;
  className?: string;
  showHeader?: boolean;
}

function TransferEventSkeleton() {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-4 border-b border-gray-800/50 last:border-0"
      aria-hidden="true"
    >
      <Skeleton className="h-7 w-20 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

export function TransferHistorySkeleton({
  count = 5,
  className,
  showHeader = true,
}: TransferHistorySkeletonProps) {
  return (
    <Card
      className={cn("border-gray-800/50 bg-gray-900/30 backdrop-blur-sm", className)}
      role="status"
      aria-label="Loading transfer history"
    >
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {Array.from({ length: count }).map((_, i) => (
          <TransferEventSkeleton key={i} />
        ))}
        <span className="sr-only">Loading transfer history...</span>
      </CardContent>
    </Card>
  );
}

export default TransferHistorySkeleton;
