"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { EmptyState, EmptyStateProps } from "./empty-state";

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------
export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Render cell content. Defaults to `String(row[key])`. */
  render?: (row: T, index: number) => React.ReactNode;
  /** Optional cell className */
  className?: string;
  /** Optional header className */
  headerClassName?: string;
  align?: "left" | "center" | "right";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Key extractor for rows */
  rowKey: (row: T, index: number) => string | number;
  /** Props forwarded to EmptyState when data is empty */
  emptyState?: Omit<EmptyStateProps, "className"> & { className?: string };
  caption?: string;
  className?: string;
  /** Extra className applied to each <tr> */
  rowClassName?: string | ((row: T, index: number) => string);
  loading?: boolean;
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Standardized accessible data table with built-in empty-state handling.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyState,
  caption,
  className,
  rowClassName,
  loading,
}: DataTableProps<T>) {
  if (!loading && data.length === 0) {
    return (
      <EmptyState
        title={emptyState?.title ?? "No data"}
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
    <div className={cn("w-full overflow-x-auto rounded-xl border border-purple-500/20", className)}>
      <table className="w-full text-sm text-left text-gray-300" aria-busy={loading}>
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}
        <thead className="text-xs uppercase text-gray-400 bg-purple-900/20 border-b border-purple-500/20">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-3 font-medium",
                  alignClass[col.align ?? "left"],
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-purple-500/10">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} aria-hidden="true">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-purple-500/10 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            : data.map((row, i) => {
                const trClass =
                  typeof rowClassName === "function"
                    ? rowClassName(row, i)
                    : rowClassName;
                return (
                  <tr
                    key={rowKey(row, i)}
                    className={cn(
                      "hover:bg-purple-500/5 transition-colors",
                      trClass
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3",
                          alignClass[col.align ?? "left"],
                          col.className
                        )}
                      >
                        {col.render
                          ? col.render(row, i)
                          : String((row as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
