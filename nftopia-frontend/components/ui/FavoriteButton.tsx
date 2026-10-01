"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/stores/preferences-store";
import { telemetry } from "@/lib/telemetry";
import { EVENT_NAMES } from "@/lib/telemetry/events";
import { cn } from "@/lib/utils";

export interface FavoriteButtonProps {
  id: string;
  itemType?: "nft" | "collection";
  name?: string;
  variant?: "icon" | "overlay" | "button" | "compact";
  size?: "sm" | "md" | "lg";
  className?: string;
  showCount?: boolean;
  count?: number;
  onToggle?: (isFavorite: boolean) => void;
}

export function FavoriteButton({
  id,
  itemType = "nft",
  name,
  variant = "overlay",
  size = "md",
  className,
  showCount = false,
  count,
  onToggle,
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted && isHydrated ? isFavorite(id, itemType) : false;

  const handleToggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      toggleFavorite(id, itemType);
      const newFavoriteState = !active;

      // Track telemetry
      try {
        telemetry.track(EVENT_NAMES.favoriteToggled, {
          id,
          itemType,
          name: name || id,
          isFavorite: newFavoriteState,
          timestamp: Date.now(),
        });
        telemetry.track(
          newFavoriteState ? EVENT_NAMES.favoriteAdded : EVENT_NAMES.favoriteRemoved,
          { id, itemType, name: name || id, timestamp: Date.now() }
        );
      } catch (err) {
        // Silently catch telemetry errors
      }

      if (onToggle) {
        onToggle(newFavoriteState);
      }
    },
    [id, itemType, name, active, toggleFavorite, onToggle]
  );

  // Icon Sizing
  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4.5 w-4.5",
    lg: "h-5 w-5",
  };

  // Icon size mapping in pixels for lucide Heart if needed
  const iconSizePx = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  // Base styling per variant
  const variantStyles = {
    overlay: cn(
      "relative z-20 flex items-center justify-center rounded-full transition-all duration-200 shadow-md",
      "bg-black/60 backdrop-blur-md border border-white/10 hover:border-purple-400/50 hover:bg-black/80 hover:scale-105 active:scale-95",
      size === "sm" && "p-1.5",
      size === "md" && "p-2",
      size === "lg" && "p-2.5",
      active && "bg-rose-950/40 border-rose-500/40 text-rose-400"
    ),
    icon: cn(
      "flex items-center justify-center rounded-lg transition-all duration-200",
      "hover:bg-white/10 text-gray-400 hover:text-white active:scale-95",
      size === "sm" && "p-1",
      size === "md" && "p-2",
      size === "lg" && "p-2.5",
      active && "text-rose-500 hover:text-rose-400"
    ),
    button: cn(
      "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 shadow-sm",
      "border border-gray-800 bg-gray-900/60 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-700 active:scale-95",
      active && "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50"
    ),
    compact: cn(
      "inline-flex items-center gap-1 text-xs font-medium transition-colors",
      active ? "text-rose-400" : "text-gray-400 hover:text-gray-200"
    ),
  };

  const labelText = active
    ? `Remove ${name || itemType} from favorites`
    : `Add ${name || itemType} to favorites`;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={labelText}
      aria-pressed={active}
      title={labelText}
      className={cn(variantStyles[variant], className)}
    >
      <Heart
        size={iconSizePx[size]}
        className={cn(
          iconSizes[size],
          "transition-all duration-200",
          active ? "fill-rose-500 text-rose-500 scale-110" : "text-gray-300 hover:text-white"
        )}
      />
      {variant === "button" && (
        <span>{active ? "Favorited" : "Favorite"}</span>
      )}
      {showCount && count !== undefined && (
        <span className={cn("text-xs font-medium ml-0.5", active ? "text-rose-300" : "text-gray-400")}>
          {count + (active ? 1 : 0)}
        </span>
      )}
    </button>
  );
}
