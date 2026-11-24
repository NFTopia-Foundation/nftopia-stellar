/**
 * Pure helpers for the marketplace price-range filter (#753): parsing the
 * free-text min/max inputs, keeping min ≤ max, and deriving slider bounds.
 * Kept separate from the component so the rules are unit-testable.
 */

/** Upper slider bound used when no listing prices are known. */
export const DEFAULT_PRICE_CEILING = 1000;

export interface PriceBounds {
  min: number;
  max: number;
}

export interface PriceRange {
  /** null = no lower bound (the minPrice URL param is omitted). */
  min: number | null;
  /** null = no upper bound (the maxPrice URL param is omitted). */
  max: number | null;
}

/**
 * Parses a user-typed price. Empty, non-numeric, non-finite or negative input
 * yields null (the bound is cleared) rather than a NaN reaching the URL.
 */
export function parsePrice(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/** Rounds a price ceiling up to a "nice" slider bound (1, 2, 5 × 10^n). */
export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PRICE_CEILING;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

/**
 * Derives slider bounds from listing prices plus the user's own typed values,
 * so a typed value is always reachable on the slider. Falls back to
 * 0..DEFAULT_PRICE_CEILING when nothing is known.
 */
export function derivePriceBounds(
  prices: ReadonlyArray<number | string | null | undefined> = [],
  range: PriceRange = { min: null, max: null },
): PriceBounds {
  const known = prices
    .map((p) => (typeof p === "string" ? parsePrice(p) : p))
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p >= 0);

  const highest = Math.max(
    0,
    ...known,
    range.min ?? 0,
    range.max ?? 0,
  );

  return {
    min: 0,
    max: highest > 0 ? niceCeiling(highest) : DEFAULT_PRICE_CEILING,
  };
}

/** Clamps a single value into [bounds.min, bounds.max]. */
export function clamp(value: number, bounds: PriceBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/**
 * Normalizes a range so min ≤ max. When the two cross, the bound the user just
 * edited (`changed`) wins and the other is pulled to meet it, which is how a
 * dual-thumb slider behaves when one thumb is pushed past the other.
 */
export function normalizeRange(
  range: PriceRange,
  changed: "min" | "max" = "min",
): PriceRange {
  const { min, max } = range;
  if (min === null || max === null || min <= max) return { min, max };
  return changed === "min" ? { min, max: min } : { min: max, max };
}

/** Serializes a bound for the URL; null clears the param. */
export function formatPriceParam(value: number | null): string {
  if (value === null) return "";
  // Avoid float noise like 0.30000000000000004 in the URL.
  return String(Number(value.toFixed(7)));
}

/** Picks a slider step that gives roughly 100–200 positions across the bounds. */
export function sliderStep(bounds: PriceBounds): number {
  const span = bounds.max - bounds.min;
  if (span <= 0) return 1;
  const raw = span / 100;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return magnitude >= 1 ? magnitude : Number(magnitude.toFixed(10));
}
