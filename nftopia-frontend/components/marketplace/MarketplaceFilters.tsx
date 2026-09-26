"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { emitCtaClicked, CTA_PLACEMENTS } from "@/lib/telemetry/navigation-instrumentation";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";

export function MarketplaceFilters() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 300);
  const sortBy = searchParams.get("sortBy") || "newest";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    } else {
      params.delete("search");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [debouncedSearch, pathname, router, searchParams]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch("");
    router.replace(pathname);
  };

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

        <div className="flex gap-2 items-center">
          <label>
            <span className="sr-only">Minimum price</span>
            <input
              type="number"
              aria-label="Minimum price"
              placeholder="Min Price"
              value={minPrice}
              onChange={(e) => updateFilter("minPrice", e.target.value)}
              className="bg-[#1E1A45] border border-purple-900/30 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 w-24"
            />
          </label>
          <span className="text-gray-400">-</span>
          <label>
            <span className="sr-only">Maximum price</span>
            <input
              type="number"
              aria-label="Maximum price"
              placeholder="Max Price"
              value={maxPrice}
              onChange={(e) => updateFilter("maxPrice", e.target.value)}
              className="bg-[#1E1A45] border border-purple-900/30 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 w-24"
            />
          </label>
        </div>

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
    </div>
  );
}
