"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type TrendDirection = "up" | "down" | "neutral";

export interface PricePoint {
  date?: string;
  price: number | string;
}

export interface FloorPriceDisplayProps {
  floorPrice?: string | number | null;
  currency?: string;
  trendPercentage?: number | null;
  trendDirection?: TrendDirection;
  historicalPrices?: Array<number | PricePoint>;
  variant?: "compact" | "detailed" | "stat-card" | "badge-only";
  showTrend?: boolean;
  showSparkline?: boolean;
  timeframe?: string;
  className?: string;
}

/**
 * Formats a raw floor price number or numeric string for display.
 */
export function formatFloorPrice(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") {
    return "0.00";
  }
  const num = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(num)) {
    return "0.00";
  }
  if (num === 0) {
    return "0.00";
  }
  if (num < 0.01) {
    return num.toFixed(4);
  }
  if (num >= 1000) {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num.toFixed(2);
}

/**
 * Parses numeric price values from an array of numbers or PricePoint objects.
 */
function extractPrices(data?: Array<number | PricePoint>): number[] {
  if (!data || !Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (typeof item === "number") return item;
      if (typeof item === "object" && item !== null && "price" in item) {
        const val = typeof item.price === "number" ? item.price : parseFloat(item.price);
        return Number.isNaN(val) ? null : val;
      }
      return null;
    })
    .filter((val): val is number => val !== null);
}

/**
 * Calculates trend percentage and direction from historical price points.
 */
export function calculateTrend(
  prices: number[],
  currentPriceNum?: number
): { percentage: number | null; direction: TrendDirection } {
  if (!prices || prices.length < 2) {
    if (currentPriceNum !== undefined && prices.length === 1) {
      const prev = prices[0];
      if (prev > 0) {
        const diff = ((currentPriceNum - prev) / prev) * 100;
        const direction: TrendDirection = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
        return { percentage: Math.round(diff * 10) / 10, direction };
      }
    }
    return { percentage: null, direction: "neutral" };
  }

  const first = prices[0];
  const last = prices[prices.length - 1];

  if (first === 0 && last === 0) {
    return { percentage: 0, direction: "neutral" };
  }
  if (first === 0) {
    return { percentage: 100, direction: "up" };
  }

  const diff = ((last - first) / first) * 100;
  const rounded = Math.round(diff * 10) / 10;
  const direction: TrendDirection = rounded > 0 ? "up" : rounded < 0 ? "down" : "neutral";

  return { percentage: rounded, direction };
}

/**
 * Simple SVG Sparkline generator.
 */
export function Sparkline({
  data,
  direction = "neutral",
  width = 80,
  height = 24,
  className = "",
}: {
  data: number[];
  direction?: TrendDirection;
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = useMemo(() => {
    if (!data || data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const innerHeight = height - padding * 2;
    const innerWidth = width - padding * 2;

    return data
      .map((val, idx) => {
        const x = padding + (idx / (data.length - 1)) * innerWidth;
        const y = height - padding - ((val - min) / range) * innerHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, width, height]);

  if (!points) return null;

  const strokeColor =
    direction === "up" ? "#10b981" : direction === "down" ? "#f43f5e" : "#a855f7";
  const gradientId = `sparkline-gradient-${direction}-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      width={width}
      height={height}
      className={`overflow-visible ${className}`}
      aria-label={`Price trend sparkline showing ${direction} movement`}
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/**
 * Reusable Floor Price Tracking Display component.
 */
export function FloorPriceDisplay({
  floorPrice,
  currency = "XLM",
  trendPercentage,
  trendDirection,
  historicalPrices,
  variant = "detailed",
  showTrend = true,
  showSparkline = true,
  timeframe = "24h",
  className = "",
}: FloorPriceDisplayProps) {
  const formattedPrice = formatFloorPrice(floorPrice);
  const parsedHistorical = useMemo(() => extractPrices(historicalPrices), [historicalPrices]);

  // Determine trend either from explicit props or historical data
  const { calculatedPercentage, resolvedDirection } = useMemo(() => {
    if (trendPercentage !== undefined && trendPercentage !== null) {
      const dir =
        trendDirection ||
        (trendPercentage > 0 ? "up" : trendPercentage < 0 ? "down" : "neutral");
      return { calculatedPercentage: trendPercentage, resolvedDirection: dir };
    }

    if (parsedHistorical.length >= 2) {
      const { percentage, direction } = calculateTrend(parsedHistorical);
      return {
        calculatedPercentage: percentage,
        resolvedDirection: trendDirection || direction,
      };
    }

    return {
      calculatedPercentage: null,
      resolvedDirection: trendDirection || "neutral",
    };
  }, [trendPercentage, trendDirection, parsedHistorical]);

  // Color mappings
  const trendColorClass =
    resolvedDirection === "up"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      : resolvedDirection === "down"
      ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
      : "text-gray-400 bg-gray-800/40 border-gray-700/30";

  const TrendIcon =
    resolvedDirection === "up"
      ? TrendingUp
      : resolvedDirection === "down"
      ? TrendingDown
      : Minus;

  // -------------------------------------------------------------
  // Badge Only Variant
  // -------------------------------------------------------------
  if (variant === "badge-only") {
    if (calculatedPercentage === null && !trendDirection) return null;
    return (
      <span
        data-testid="floor-price-trend-badge"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${trendColorClass} ${className}`}
      >
        <TrendIcon className="w-3 h-3" data-testid={`trend-icon-${resolvedDirection}`} />
        <span>
          {calculatedPercentage !== null
            ? `${calculatedPercentage > 0 ? "+" : ""}${calculatedPercentage.toFixed(1)}%`
            : resolvedDirection}
        </span>
      </span>
    );
  }

  // -------------------------------------------------------------
  // Compact Variant (e.g. for CollectionCard / Browse list)
  // -------------------------------------------------------------
  if (variant === "compact") {
    return (
      <div
        data-testid="floor-price-compact"
        className={`inline-flex items-center gap-2 text-xs ${className}`}
      >
        <span className="font-semibold text-white tracking-tight">
          {formattedPrice} {currency}
        </span>
        {showTrend && (calculatedPercentage !== null || trendDirection) && (
          <span
            data-testid="floor-price-trend-badge"
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium border ${trendColorClass}`}
          >
            <TrendIcon className="w-2.5 h-2.5" data-testid={`trend-icon-${resolvedDirection}`} />
            <span>
              {calculatedPercentage !== null
                ? `${calculatedPercentage > 0 ? "+" : ""}${calculatedPercentage.toFixed(1)}%`
                : resolvedDirection}
            </span>
          </span>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // Stat Card Variant (e.g. For Collection Detail Hero Stats)
  // -------------------------------------------------------------
  if (variant === "stat-card") {
    return (
      <div
        data-testid="floor-price-stat-card"
        className={`p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30 flex flex-col justify-between relative overflow-hidden group hover:border-purple-600/40 transition-all ${className}`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs text-gray-400 font-medium">Floor Price</p>
          {showTrend && (calculatedPercentage !== null || trendDirection) && (
            <span
              data-testid="floor-price-trend-badge"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${trendColorClass}`}
            >
              <TrendIcon className="w-3 h-3" data-testid={`trend-icon-${resolvedDirection}`} />
              <span>
                {calculatedPercentage !== null
                  ? `${calculatedPercentage > 0 ? "+" : ""}${calculatedPercentage.toFixed(1)}%`
                  : resolvedDirection}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2 mt-1">
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {formattedPrice}{" "}
            <span className="text-xs font-normal text-purple-300">{currency}</span>
          </p>

          {showSparkline && parsedHistorical.length >= 2 && (
            <div data-testid="floor-price-sparkline" className="hidden sm:block">
              <Sparkline
                data={parsedHistorical}
                direction={resolvedDirection}
                width={70}
                height={20}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Detailed Variant (Default Full Analytics Display)
  // -------------------------------------------------------------
  return (
    <div
      data-testid="floor-price-detailed"
      className={`p-5 rounded-2xl bg-[#1E1A45]/80 backdrop-blur-sm border border-purple-900/40 shadow-xl ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
          Floor Price Tracking
        </span>
        {timeframe && (
          <span className="text-[11px] text-gray-400 bg-black/30 px-2 py-0.5 rounded-full border border-purple-900/20">
            {timeframe}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {formattedPrice}
            </span>
            <span className="text-sm font-semibold text-purple-300">{currency}</span>
          </div>

          {showTrend && (calculatedPercentage !== null || trendDirection) && (
            <div className="flex items-center gap-2 mt-1.5">
              <span
                data-testid="floor-price-trend-badge"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${trendColorClass}`}
              >
                <TrendIcon className="w-3.5 h-3.5" data-testid={`trend-icon-${resolvedDirection}`} />
                <span>
                  {calculatedPercentage !== null
                    ? `${calculatedPercentage > 0 ? "+" : ""}${calculatedPercentage.toFixed(1)}%`
                    : resolvedDirection}
                </span>
              </span>
              <span className="text-xs text-gray-400">
                {resolvedDirection === "up"
                  ? "Floor is rising"
                  : resolvedDirection === "down"
                  ? "Floor is dropping"
                  : "Floor is stable"}
              </span>
            </div>
          )}
        </div>

        {showSparkline && parsedHistorical.length >= 2 && (
          <div data-testid="floor-price-sparkline" className="flex flex-col items-end">
            <Sparkline
              data={parsedHistorical}
              direction={resolvedDirection}
              width={90}
              height={30}
            />
            <span className="text-[10px] text-gray-500 mt-1">Price trend</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default FloorPriceDisplay;
