/**
 * Bundle size budget configuration for NFTopia Frontend.
 *
 * Enforced in CI on PRs touching frontend code to prevent bundle size regressions.
 * All limits are evaluated against Brotli-compressed static assets (matching production CDN delivery).
 * Thresholds provide a safety headroom (~15-30%) above current baselines to avoid false positives
 * on minor tweaks while failing the check if a heavy dependency or regression is introduced.
 *
 * To adjust a budget when a legitimate feature is added:
 * 1. Run `npm run analyze` to inspect the bundle breakdown (writes to .next/analyze/client.html).
 * 2. Ensure third-party libraries are properly tree-shaken and dynamic imports / lazy-loading
 *    (`next/dynamic`) are utilized where appropriate.
 * 3. Update the specific target limit below and document the rationale in the PR description.
 */

module.exports = [
  // ── Core Framework & Next.js Runtime ─────────────────────────────────────────
  {
    name: "Framework & Next.js Runtime",
    path: [
      ".next/static/chunks/framework-*.js",
      ".next/static/chunks/main-app-*.js",
      ".next/static/chunks/webpack-*.js",
    ],
    limit: "55 kB",
  },

  // ── Browser Compatibility Polyfills ──────────────────────────────────────────
  {
    name: "Global Polyfills",
    path: ".next/static/chunks/polyfills-*.js",
    limit: "35 kB",
  },

  // ── Global Stylesheets ───────────────────────────────────────────────────────
  {
    name: "Global Stylesheets (CSS)",
    path: ".next/static/css/*.css",
    limit: "25 kB",
  },

  // ── App Layouts (Root & Locale Shells) ───────────────────────────────────────
  {
    name: "App Layouts (Root & Shared)",
    path: ".next/static/chunks/app/**/layout-*.js",
    limit: "28 kB",
  },

  // ── Critical Landing Page Route ──────────────────────────────────────────────
  {
    name: "Landing / Home Page Route",
    path: [
      ".next/static/chunks/app/*/page-*.js",
      ".next/static/chunks/app/page-*.js",
    ],
    limit: "22 kB",
  },

  // ── Marketplace Routes ───────────────────────────────────────────────────────
  {
    name: "Marketplace Browse Page",
    path: ".next/static/chunks/app/*/marketplace/page-*.js",
    limit: "20 kB",
  },
  {
    name: "Marketplace NFT Detail Page",
    path: ".next/static/chunks/app/*/marketplace/*/page-*.js",
    limit: "15 kB",
  },
  {
    name: "Marketplace Auction Detail Page",
    path: ".next/static/chunks/app/*/marketplace/auction/*/page-*.js",
    limit: "15 kB",
  },
  {
    name: "Marketplace Auctions List Page",
    path: ".next/static/chunks/app/*/marketplace/auctions/page-*.js",
    limit: "15 kB",
  },

  // ── Creator & Collection Routes ──────────────────────────────────────────────
  {
    name: "Collection Detail Page",
    path: ".next/static/chunks/app/*/collection/*/page-*.js",
    limit: "18 kB",
  },
  {
    name: "Creator Profile Page",
    path: ".next/static/chunks/app/*/creator/*/page-*.js",
    limit: "16 kB",
  },

  // ── Creator Dashboard Flows ──────────────────────────────────────────────────
  {
    name: "Creator Dashboard Pages",
    path: ".next/static/chunks/app/*/creator-dashboard/**/page-*.js",
    limit: "75 kB",
  },

  // ── Authentication & Onboarding Flows ────────────────────────────────────────
  {
    name: "Authentication Pages",
    path: ".next/static/chunks/app/*/auth/**/page-*.js",
    limit: "28 kB",
  },

  // ── User Account & Settings ──────────────────────────────────────────────────
  {
    name: "Account & Settings Pages",
    path: ".next/static/chunks/app/*/account/**/page-*.js",
    limit: "20 kB",
  },

  // ── Total Client Static JavaScript Ceiling ───────────────────────────────────
  {
    name: "Total Client Static JavaScript",
    path: ".next/static/chunks/**/*.js",
    limit: "1.35 MB",
  },
];
