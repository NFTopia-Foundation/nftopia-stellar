"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  clamp,
  normalizeRange,
  parsePrice,
  sliderStep,
  type PriceBounds,
  type PriceRange,
} from "@/lib/marketplace/price-range";

export const PRICE_DEBOUNCE_MS = 400;

interface PriceRangeSliderProps {
  /** Current minPrice URL param ("" when unset). */
  minValue: string;
  /** Current maxPrice URL param ("" when unset). */
  maxValue: string;
  bounds: PriceBounds;
  /** Called (debounced) with a validated min ≤ max range to write to the URL. */
  onCommit: (range: PriceRange) => void;
  labels: {
    group: string;
    minThumb: string;
    maxThumb: string;
    invalid: string;
  };
  currency?: string;
  debounceMs?: number;
}

const inputClass =
  "bg-[#1E1A45] border border-purple-900/30 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 w-24 aria-[invalid=true]:border-red-500";

// Two native range inputs stacked on one track. The track itself ignores
// pointer events so only each thumb is draggable; both remain independently
// focusable and keyboard-operable (arrows, PageUp/Down, Home/End) for free.
const rangeClass =
  "pointer-events-none absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent " +
  "focus:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-purple-300 " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-purple-400";

/**
 * Dual-thumb price range control (#753) kept in sync with the existing
 * min/max text inputs. Typing and dragging update local state immediately;
 * the URL (and therefore the listings refetch) is only updated once input
 * settles for `debounceMs`. A committed range is always valid: negative /
 * non-numeric input clears that bound, and if min would exceed max, the bound
 * edited last wins and the other is pulled to meet it.
 */
export function PriceRangeSlider({
  minValue,
  maxValue,
  bounds,
  onCommit,
  labels,
  currency = "XLM",
  debounceMs = PRICE_DEBOUNCE_MS,
}: PriceRangeSliderProps) {
  const groupId = useId();
  const errorId = useId();
  const [minText, setMinText] = useState(minValue);
  const [maxText, setMaxText] = useState(maxValue);
  const lastEdited = useRef<"min" | "max">("min");
  const dirty = useRef(false);

  // Adopt URL changes made elsewhere (clear filters, applying a preset),
  // without clobbering in-progress typing such as "5." that parses the same.
  useEffect(() => {
    setMinText((text) => (parsePrice(text) === parsePrice(minValue) ? text : minValue));
  }, [minValue]);
  useEffect(() => {
    setMaxText((text) => (parsePrice(text) === parsePrice(maxValue) ? text : maxValue));
  }, [maxValue]);

  const draftMin = parsePrice(minText);
  const draftMax = parsePrice(maxText);
  const invalid = draftMin !== null && draftMax !== null && draftMin > draftMax;

  const debouncedKey = useDebounce(`${minText}|${maxText}`, debounceMs);

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (!dirty.current) return;
    dirty.current = false;
    const [rawMin, rawMax] = debouncedKey.split("|");
    const range = normalizeRange(
      { min: parsePrice(rawMin), max: parsePrice(rawMax) },
      lastEdited.current,
    );
    // Reflect any correction (crossed bounds, junk input) back into the inputs.
    setMinText(range.min === null ? "" : String(range.min));
    setMaxText(range.max === null ? "" : String(range.max));
    if (range.min !== parsePrice(minValue) || range.max !== parsePrice(maxValue)) {
      onCommitRef.current(range);
    }
    // Only the settled draft should trigger a commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey]);

  const editMin = (text: string) => {
    lastEdited.current = "min";
    dirty.current = true;
    setMinText(text);
  };
  const editMax = (text: string) => {
    lastEdited.current = "max";
    dirty.current = true;
    setMaxText(text);
  };

  const step = sliderStep(bounds);
  const sliderMin = clamp(draftMin ?? bounds.min, bounds);
  const sliderMax = clamp(draftMax ?? bounds.max, bounds);
  const span = bounds.max - bounds.min || 1;
  const lowPct = ((Math.min(sliderMin, sliderMax) - bounds.min) / span) * 100;
  const highPct = ((Math.max(sliderMin, sliderMax) - bounds.min) / span) * 100;

  return (
    <div role="group" aria-labelledby={groupId} className="flex flex-col gap-2">
      <span id={groupId} className="sr-only">
        {labels.group}
      </span>
      <div className="flex gap-2 items-center">
        <label>
          <span className="sr-only">Minimum price</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            aria-label="Minimum price"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            placeholder="Min Price"
            value={minText}
            onChange={(e) => editMin(e.target.value)}
            className={inputClass}
          />
        </label>
        <span className="text-gray-400" aria-hidden="true">
          -
        </span>
        <label>
          <span className="sr-only">Maximum price</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            aria-label="Maximum price"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            placeholder="Max Price"
            value={maxText}
            onChange={(e) => editMax(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="relative h-5 w-56" data-testid="price-range-slider">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-purple-900/40" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-purple-500"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        <input
          type="range"
          aria-label={labels.minThumb}
          aria-valuetext={`${sliderMin} ${currency}`}
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={sliderMin}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), sliderMax);
            editMin(v <= bounds.min ? "" : String(v));
          }}
          className={rangeClass}
        />
        <input
          type="range"
          aria-label={labels.maxThumb}
          aria-valuetext={`${sliderMax} ${currency}`}
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={sliderMax}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), sliderMin);
            // The top of the track means "no upper limit".
            editMax(v >= bounds.max ? "" : String(v));
          }}
          className={rangeClass}
        />
      </div>

      {invalid && (
        <p id={errorId} role="alert" className="text-xs text-red-400">
          {labels.invalid}
        </p>
      )}
    </div>
  );
}
