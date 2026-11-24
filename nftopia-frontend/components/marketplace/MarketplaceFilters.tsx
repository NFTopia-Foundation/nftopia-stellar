"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/lib/stores/auth-store";
import { PriceRangeSlider } from "./PriceRangeSlider";
import { FilterPresets } from "./FilterPresets";
import {
  derivePriceBounds,
  formatPriceParam,
  parsePrice,
  type PriceRange,
} from "@/lib/marketplace/price-range";

interface MarketplaceFiltersProps {
  /** Prices of the listings currently loaded, used to size the price slider (#753). */
  listingPrices?: ReadonlyArray<number | string | null | undefined>;
}

export function MarketplaceFilters({ listingPrices = [] }: MarketplaceFiltersProps = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = useAuthStore((state: { user?: { id?: string } | null }) => state.user?.id ?? null);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 300);
  const sortBy = searchParams.get("sortBy") || "newest";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const currentQuery = searchParams.toString();

  // Latest URL state for effects that should only fire on their own trigger.
  const latest = useRef({ searchParams, pathname, router });
  latest.current = { searchParams, pathname, router };

  // Push the debounced search term into the URL — only when it actually
  // differs, so applying a preset or clearing filters isn't overwritten by a
  // stale local search value.
  useEffect(() => {
    const { searchParams: sp, pathname: path, router: r } = latest.current;
    if (debouncedSearch === (sp.get("search") || "")) return;
    const params = new URLSearchParams(sp.toString());
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    } else {
      params.delete("search");
    }
    r.replace(`${path}?${params.toString()}`);
  }, [debouncedSearch]);

  const replaceParams = (params: URLSearchParams) => {
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceParams(params);
  };

  const commitPriceRange = (range: PriceRange) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of [
      ["minPrice", formatPriceParam(range.min)],
      ["maxPrice", formatPriceParam(range.max)],
    ] as const) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    replaceParams(params);
  };

  const applyPreset = (query: string) => {
    const params = new URLSearchParams(query);
    setSearch(params.get("search") || "");
    replaceParams(params);
  };

  const clearFilters = () => {
    setSearch("");
    router.replace(pathname);
  };

  const priceBounds = useMemo(
    () =>
      derivePriceBounds(listingPrices, {
        min: parsePrice(minPrice),
        max: parsePrice(maxPrice),
      }),
    [listingPrices, minPrice, maxPrice],
  );

  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t("todaysPicks.title")}</h2>
        <Button variant="ghost" onClick={clearFilters} className="text-purple-400 hover:text-purple-300">
          Clear Filters
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <label className="w-full md:w-auto">
          <span className="sr-only">Search NFTs</span>
          <input
            type="search"
            aria-label="Search NFTs"
            placeholder="Search NFTs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#1E1A45] border border-purple-900/30 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 w-full md:w-auto"
          />
        </label>

        <PriceRangeSlider
          minValue={minPrice}
          maxValue={maxPrice}
          bounds={priceBounds}
          onCommit={commitPriceRange}
          labels={{
            group: t("marketplace.priceRange.group"),
            minThumb: t("marketplace.priceRange.minThumb"),
            maxThumb: t("marketplace.priceRange.maxThumb"),
            invalid: t("marketplace.priceRange.invalid"),
          }}
        />

        <label>
          <span className="sr-only">Sort marketplace results</span>
          <select
            aria-label="Sort marketplace results"
            value={sortBy}
            onChange={(e) => updateFilter("sortBy", e.target.value)}
            className="bg-[#1E1A45] border border-purple-900/30 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </label>
      </div>

      <FilterPresets userId={userId} currentQuery={currentQuery} onApply={applyPreset} />
    </div>
  );
}
