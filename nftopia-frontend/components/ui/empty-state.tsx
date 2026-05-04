"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  /** Icon or illustration to display */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Primary action button label */
  actionLabel?: string;
  onAction?: () => void;
  /** Secondary action button label */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

/**
 * Reusable empty-state component.
 * Renders a centred message with optional icon and action buttons.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 px-6 text-center",
        className
      )}
    >
      {icon && (
        <div className="text-purple-400/60 mb-2" aria-hidden="true">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-white">{title}</h3>

      {description && (
        <p className="text-sm text-gray-400 max-w-sm">{description}</p>
      )}

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {actionLabel && onAction && (
            <Button onClick={onAction} size="sm">
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
