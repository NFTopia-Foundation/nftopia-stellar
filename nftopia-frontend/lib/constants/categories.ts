export interface MarketplaceCategory {
  id: string;
  labelKey: string;
  icon: string;
}

/**
 * Canonical category taxonomy for marketplace discovery.
 *
 * Mirrors nftopia-mobile-app/constants/categories.ts (kept in sync by hand -
 * the two apps are separate projects with no shared package). These ids map
 * 1:1 to the free-text `category` field on marketplace listings
 * (ListingFilterInput.category in the backend GraphQL schema), so a listing
 * tagged with a matching category string surfaces under the same chip on
 * both platforms.
 */
export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { id: "art", labelKey: "marketplace.categories.art", icon: "🎨" },
  { id: "music", labelKey: "marketplace.categories.music", icon: "🎵" },
  { id: "gaming", labelKey: "marketplace.categories.gaming", icon: "🎮" },
  {
    id: "photography",
    labelKey: "marketplace.categories.photography",
    icon: "📷",
  },
  {
    id: "collectibles",
    labelKey: "marketplace.categories.collectibles",
    icon: "🧩",
  },
  { id: "sports", labelKey: "marketplace.categories.sports", icon: "⚽" },
  {
    id: "virtual-worlds",
    labelKey: "marketplace.categories.virtualWorlds",
    icon: "🌐",
  },
  { id: "utility", labelKey: "marketplace.categories.utility", icon: "🛠️" },
];

export function findMarketplaceCategoryById(
  id: string,
): MarketplaceCategory | undefined {
  return MARKETPLACE_CATEGORIES.find((category) => category.id === id);
}
