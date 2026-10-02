import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const locales = ["en", "fr", "es", "de"] as const;

/**
 * Public, crawlable surfaces only. Everything behind auth or the creator
 * dashboard is excluded here and disallowed in `app/robots.ts`.
 *
 * These routes are static, so the sitemap never needs the GraphQL API and can
 * be generated at build time.
 */
const routes: Array<{ path: string; priority: number }> = [
  { path: "", priority: 1 },
  { path: "/marketplace", priority: 0.9 },
  { path: "/marketplace/auctions", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${baseUrl}/${locale}${route.path}`,
      lastModified: new Date(),
      changeFrequency: route.path === "" ? "daily" : "weekly",
      priority: route.priority,
    })),
  );
}
