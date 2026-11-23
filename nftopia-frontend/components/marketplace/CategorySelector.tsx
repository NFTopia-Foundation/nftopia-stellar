"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants/categories";
import {
  CTA_IDS,
  CTA_PLACEMENTS,
  emitCtaClicked,
  normalizeRoute,
} from "@/lib/telemetry/navigation-instrumentation";

/**
 * Horizontal row of category chips that drives the `?category=` filter
 * consumed by MarketplaceListings' "All listings" section below it — the
 * same URL-param pattern MarketplaceFilters already uses for
 * search/minPrice/maxPrice/sortBy (see components/marketplace/README.md).
 *
 * The category ids come from lib/constants/categories.ts, which mirrors
 * nftopia-mobile-app/constants/categories.ts so a listing tagged e.g.
 * "gaming" surfaces under the same chip on both platforms.
 */
export function CategorySelector() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  const selectCategory = (categoryId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId) {
      params.set("category", categoryId);
    } else {
      params.delete("category");
    }
    const query = params.toString();
    const destination = query ? `${pathname}?${query}` : pathname;
    router.replace(destination, { scroll: false });

    emitCtaClicked({
      cta_id: CTA_IDS.FILTER_CATEGORY,
      placement: CTA_PLACEMENTS.MARKETPLACE_FILTER_BAR,
      destination_route: normalizeRoute(destination),
      interaction_type: "button",
      ui_variant: "secondary",
      category_id: categoryId ?? "all",
    });
  };

  const chipClassName = (selected: boolean) =>
    cn(
      "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
      selected
        ? "border-purple-500 bg-purple-500/20 text-white"
        : "border-purple-900/30 bg-[#1E1A45] text-white/70 hover:border-purple-500/50 hover:text-white",
    );

  return (
    <section aria-labelledby="category-discovery-heading" className="space-y-4">
      <h2 id="category-discovery-heading" className="text-2xl font-bold">
        {t("marketplace.categoriesTitle")}
      </h2>
      <div
        role="group"
        aria-label="Browse marketplace categories"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        <button
          type="button"
          aria-pressed={activeCategory === null}
          onClick={() => selectCategory(null)}
          className={chipClassName(activeCategory === null)}
        >
          {t("marketplace.categories.all")}
        </button>
        {MARKETPLACE_CATEGORIES.map((category) => {
          const selected = activeCategory === category.id;
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={selected}
              onClick={() => selectCategory(category.id)}
              className={chipClassName(selected)}
            >
              <span aria-hidden>{category.icon}</span>
              {t(category.labelKey)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
