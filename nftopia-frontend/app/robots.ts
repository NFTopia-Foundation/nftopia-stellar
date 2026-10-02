import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/**
 * `/robots.txt` used to fall through to the `[locale]` dynamic segment, so
 * crawlers received the app shell HTML instead of a robots file (the Lighthouse
 * SEO budget reports this as `robots-txt` -> "robots.txt is not valid"). A
 * metadata route is a static route, so it takes precedence over the dynamic
 * locale segment.
 *
 * Keep the disallow list in sync with the surfaces that are authenticated or
 * dashboard-only: they have no SEO value and should never be indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/creator-dashboard/",
          "/*/auth/",
          "/*/creator-dashboard/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
