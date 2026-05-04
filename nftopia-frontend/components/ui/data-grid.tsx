"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { EmptyState, EmptyStateProps } from "./empty-state";

export interface DataGridProps<T> {
  data: T[];
  /** Render a single card */
  renderItem: (item: T, index: number) => React.ReactNode;
  rowKey: (item: T, index: number) => string | number;
  /** Responsive column counts */
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: "sm" | "md" | "lg";
  emptyState?: Omit<EmptyStateProps, "className"> & { className?: string };
  className?: string;
  loading?: boolean;
  /** Skeleton card count shown while loading */
  skeletonCount?: number;
  /** Render a skeleton card */
  renderSkeleton?: (index: number) => React.ReactNode;
}

const gapClass = { sm: "gap-3", md: "gap-6", lg: "gap-8" };

const colsClass = (cols: DataGridProps<unknown>["cols"] = {}) => {
  const { default: d = 1, sm, md, lg, xl } = cols;
  return [
    `grid-cols-${d}`,
    sm && `sm:grid-cols-${sm}`,
    md && `md:grid-cols-${md}`,
    lg && `lg:grid-cols-${lg}`,
    xl && `xl:grid-cols-${xl}`,
  ]
    .filter(Boolean)
    .join(" ");
};

/**
 * Standardized responsive grid with empty-state and loading skeleton support.
 */
export function DataGrid<T>({
  data,
  renderItem,
  rowKey,
  cols = { default: 1, sm: 2, md: 3, lg: 4 },
  gap = "md",
  emptyState,
  className,
  loading,
  skeletonCount = 8,
  renderSkeleton,
}: DataGridProps<T>) {
  if (!loading && data.length === 0) {
    return (
      <EmptyState
        title={emptyState?.title ?? "Nothing here yet"}
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
    <div
      className={cn("grid", colsClass(cols), gapClass[gap], className)}
      aria-busy={loading}
    >
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) =>
            renderSkeleton ? (
              renderSkeleton(i)
            ) : (
              <div
                key={i}
                aria-hidden="true"
                className="rounded-2xl bg-purple-500/10 animate-pulse h-64"
              />
            )
          )
        : data.map((item, i) => (
            <React.Fragment key={rowKey(item, i)}>
              {renderItem(item, i)}
            </React.Fragment>
          ))}
    </div>
  );
}
