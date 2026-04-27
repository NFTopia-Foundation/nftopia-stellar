"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { EmptyState, EmptyStateProps } from "./empty-state";

export interface DataListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  rowKey: (item: T, index: number) => string | number;
  emptyState?: Omit<EmptyStateProps, "className"> & { className?: string };
  className?: string;
  /** Extra className for each list item wrapper */
  itemClassName?: string;
  loading?: boolean;
  skeletonCount?: number;
  /** Render a skeleton row */
  renderSkeleton?: (index: number) => React.ReactNode;
  /** Accessible label for the list */
  "aria-label"?: string;
}

/**
 * Standardized accessible list with empty-state and loading skeleton support.
 */
export function DataList<T>({
  data,
  renderItem,
  rowKey,
  emptyState,
  className,
  itemClassName,
  loading,
  skeletonCount = 5,
  renderSkeleton,
  "aria-label": ariaLabel,
}: DataListProps<T>) {
  if (!loading && data.length === 0) {
    return (
      <EmptyState
        title={emptyState?.title ?? "No items"}
        description={emptyState?.description}
        icon={emptyState?.icon}
        actionLabel={emptyState?.actionLabel}
        onAction={emptyState?.onAction}
        secondaryActionLabel={emptyState?.secondaryActionLabel}
        onSecondaryAction={emptyState?.onSecondaryAction}
        className={emptyState?.className}
      />
    );
  }

  return (
    <ul
      role="list"
      aria-label={ariaLabel}
      aria-busy={loading}
      className={cn("divide-y divide-purple-500/10", className)}
    >
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) =>
            renderSkeleton ? (
              <li key={i} aria-hidden="true">{renderSkeleton(i)}</li>
            ) : (
              <li key={i} aria-hidden="true" className="py-3 px-4">
                <div className="h-4 bg-purple-500/10 rounded animate-pulse w-3/4" />
              </li>
            )
          )
        : data.map((item, i) => (
            <li key={rowKey(item, i)} className={cn("py-1", itemClassName)}>
              {renderItem(item, i)}
            </li>
          ))}
    </ul>
  );
}
