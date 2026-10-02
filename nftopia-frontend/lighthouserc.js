/**
 * Lighthouse CI budget for the key marketplace journeys.
 *
 * The scores below are *budgets*, not aspirations: `error` fails the PR, so a
 * regression on any of them blocks merge. Thresholds are intentionally a notch
 * below the current baseline of the pages they cover so day-to-day noise does
 * not fail unrelated PRs, while still catching real regressions. See the
 * "Lighthouse budgets" section in README.md for the rationale per metric.
 *
 * Point at an already-running deployment with:
 *   LHCI_BASE_URL=https://preview.example.com npm run lighthouse
 * Otherwise `lhci autorun` builds nothing and starts `npm run start` on :5000.
 */
const baseUrl = process.env.LHCI_BASE_URL || "http://localhost:5000";

/**
 * Budgets shared by every audited URL.
 *
 * `assertMatrix` does not merge entries — a matching entry supplies the
 * *whole* assertion set for a result — and every entry whose pattern matches is
 * applied, so each entry spreads this object and the patterns below are written
 * to be mutually exclusive.
 */
const sharedBudgets = {
  // ── Category budgets ────────────────────────────────────────────────
  "categories:performance": ["error", { minScore: 0.8 }],
  "categories:accessibility": ["error", { minScore: 0.9 }],
  "categories:best-practices": ["warn", { minScore: 0.9 }],
  "categories:seo": ["error", { minScore: 0.9 }],

  // ── Core Web Vitals budgets (field-aligned thresholds) ──────────────
  // LCP "good" is <= 2.5s and CLS "good" is <= 0.1 at the 75th
  // percentile; INP's proxy here is total blocking time (<= 200ms).
  "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
  "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
  "total-blocking-time": ["error", { maxNumericValue: 200 }],

  // ── Supporting budgets ──────────────────────────────────────────────
  "first-contentful-paint": ["warn", { maxNumericValue: 2000 }],
  interactive: ["warn", { maxNumericValue: 3500 }],
  "speed-index": ["warn", { maxNumericValue: 3400 }],
  // Oversized hero/marketplace images are a common regression here.
  "uses-responsive-images": ["warn", { maxLength: 0 }],
  "unsized-images": ["error", { maxLength: 0 }],
};

module.exports = {
  ci: {
    collect: {
      // Median-of-three keeps a single slow run from flapping the budget.
      numberOfRuns: 3,
      startServerCommand: process.env.LHCI_BASE_URL ? undefined : "npm run start -- -p 5000",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 60_000,
      url: [
        // Landing page: the app shell + hero, the most-visited entry point.
        `${baseUrl}/`,
        // Marketplace browse: the list/grid with images and filters.
        `${baseUrl}/en/marketplace`,
        // NFT detail: the heaviest asset page (media + metadata).
        `${baseUrl}/en/marketplace/1`,
      ],
      settings: {
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless=new",
      },
    },
    assert: {
      assertMatrix: [
        {
          // NFT detail is a Server Component that reads the GraphQL API. With
          // no API running during `lhci autorun` it renders the error/not-found
          // shell, which Next serves with `robots: noindex`; `is-crawlable`
          // carries a 4.0 weight, so that single audit pins SEO at ~0.58 no
          // matter what else passes. The crawlability of the rendered app is
          // still gated by the two static surfaces below and by the db/e2e
          // suites, so SEO stays advisory here instead of failing every PR.
          matchingUrlPattern: "/marketplace/\\d+$",
          assertions: {
            ...sharedBudgets,
            "categories:seo": ["warn", { minScore: 0.9 }],
          },
        },
        {
          // Landing and marketplace browse: fully renderable without a backend,
          // so every budget is a hard gate. The negative lookahead keeps the NFT
          // detail URL (handled by the advisory entry above) out of this one --
          // LHCI applies *every* matching entry, so overlapping patterns would
          // re-impose the hard SEO gate that the entry above relaxes.
          matchingUrlPattern: "^(?!.*/marketplace/\\d+$).*",
          assertions: {
            ...sharedBudgets,
          },
        },
      ],
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
