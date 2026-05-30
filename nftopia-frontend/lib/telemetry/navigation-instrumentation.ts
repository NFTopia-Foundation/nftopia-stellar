// Canonical CTA and Navigation Telemetry Instrumentation
// Issue #238

// --- Stable ID Registries ---
export const CTA_IDS = {
  CONNECT_WALLET_HEADER: "connect_wallet_header",
  EXPLORE_MORE_POPULAR_COLLECTION: "explore_more_popular_collection",
  CREATE_NFT_DASHBOARD: "create_nft_dashboard",
  MINT_NFT_LANDING: "mint_nft_landing",
  SELL_NFT_MARKETPLACE: "sell_nft_marketplace",
  CATEGORY_CARD_CLICK: "category_card_click",
  // ...add more as needed
} as const;

export const NAV_ITEM_IDS = {
  HOME: "home",
  EXPLORE: "explore",
  MARKETPLACE: "marketplace",
  ARTISTS: "artists",
  VAULT: "vault",
  CREATE: "create",
  COLLECTIONS: "collections",
  ACTIVITY: "activity",
  // ...add more as needed
} as const;

export const CTA_PLACEMENTS = {
  NAVBAR_DESKTOP_RIGHT: "navbar_desktop_right",
  NAVBAR_DESKTOP_LEFT: "navbar_desktop_left",
  NAVBAR_MOBILE_DRAWER: "navbar_mobile_drawer",
  LANDING_HERO_PRIMARY: "landing_hero_primary",
  LANDING_POPULAR_COLLECTION_HEADER: "landing_popular_collection_header",
  LANDING_EXPLORE_CATEGORIES_CARD: "landing_explore_categories_card",
  MARKETPLACE_HEADER: "marketplace_header",
  MARKETPLACE_FILTER_BAR: "marketplace_filter_bar",
  DASHBOARD_QUICK_ACTIONS: "dashboard_quick_actions",
  CREATOR_DASHBOARD_ENTRY: "creator_dashboard_entry",
  // ...add more as needed
} as const;

export const NAV_PLACEMENTS = {
  NAVBAR_DESKTOP: "navbar_desktop",
  NAVBAR_MOBILE_DRAWER: "navbar_mobile_drawer",
  FOOTER_NAV: "footer_nav",
  DASHBOARD_NAV: "dashboard_nav",
  // ...add more as needed
} as const;

// --- Event Payload Types ---
export type CTAInteractionType = "button" | "link" | "icon_button" | "card";
export type CTAUiVariant = "primary" | "secondary" | "ghost" | "outline" | "text" | "unknown";

export interface CtaClickedPayload {
  cta_id: typeof CTA_IDS[keyof typeof CTA_IDS];
  placement: typeof CTA_PLACEMENTS[keyof typeof CTA_PLACEMENTS];
  destination_route: string;
  interaction_type: CTAInteractionType;
  ui_variant: CTAUiVariant;
  authenticated?: boolean;
  locale_source?: string;
  has_wallet_connected?: boolean;
  // Optionals: modal_id, category_id, etc.
  [key: string]: any;
}

export type NavMenuState = "expanded" | "collapsed" | "drawer_open" | "unknown";

export interface NavItemClickedPayload {
  nav_item_id: typeof NAV_ITEM_IDS[keyof typeof NAV_ITEM_IDS];
  placement: typeof NAV_PLACEMENTS[keyof typeof NAV_PLACEMENTS];
  destination_route: string;
  menu_state: NavMenuState;
  authenticated?: boolean;
  locale_source?: string;
  [key: string]: any;
}

// --- Route Normalization Utility ---
export function normalizeRoute(route: string): string {
  if (!route) return "none";
  try {
    const url = new URL(route, "http://dummy");
    return url.pathname.replace(/\/$/, "");
  } catch {
    // Not a full URL, treat as path
    return route.split(/[?#]/)[0].replace(/\/$/, "");
  }
}

// --- Deduplication Helper ---
const firedEvents = new WeakSet<Event>();
export function dedupeClickEvent(e: Event): boolean {
  if (firedEvents.has(e)) return false;
  firedEvents.add(e);
  return true;
}

// --- Event Emitters (to be wired to telemetry.track) ---
import { telemetry } from "./index";

export function emitCtaClicked(payload: CtaClickedPayload, e?: Event) {
  if (e && !dedupeClickEvent(e)) return;
  telemetry.track("cta_clicked", payload);
}

export function emitNavItemClicked(payload: NavItemClickedPayload, e?: Event) {
  if (e && !dedupeClickEvent(e)) return;
  telemetry.track("nav_item_clicked", payload);
}

// --- Registry Enforcement ---
export function isValidCtaId(id: string): boolean {
  return Object.values(CTA_IDS).includes(id as any);
}
export function isValidNavItemId(id: string): boolean {
  return Object.values(NAV_ITEM_IDS).includes(id as any);
}
export function isValidCtaPlacement(placement: string): boolean {
  return Object.values(CTA_PLACEMENTS).includes(placement as any);
}
export function isValidNavPlacement(placement: string): boolean {
  return Object.values(NAV_PLACEMENTS).includes(placement as any);
}
