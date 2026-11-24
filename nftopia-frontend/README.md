# NFTopia Frontend
**Localized Stellar Marketplace Web App**

![Next.js](https://img.shields.io/badge/Next.js-13-black)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-06b6d4)
![Apollo](https://img.shields.io/badge/Apollo-GraphQL-311c87)
![Stellar](https://img.shields.io/badge/Stellar-Wallets-111827)
![PWA](https://img.shields.io/badge/PWA-Enabled-2563eb)
![Jest](https://img.shields.io/badge/Jest-Tested-c21325)

NFTopia Frontend is the browser-based marketplace and creator interface for the NFTopia platform. It is built with Next.js and combines locale-aware routing, Stellar wallet connectivity, GraphQL consumption, responsive layouts, PWA support, and creator-facing flows such as minting and collection management.

## 🌟 Key Features

- **Locale-based app routing** under `app/[locale]`
- **Responsive marketplace UI** with Tailwind and reusable component primitives
- **Stellar wallet integration** centered on Freighter and Albedo flows
- **GraphQL client layer** for typed queries and mutations
- **PWA support** through `next-pwa`
- **Translation validation** for EN, FR, ES, and DE locale files
- **Jest-based frontend tests** and accessibility-oriented checks

## 📋 Table of Contents

1. [Architecture](#-architecture)
2. [Route Map](#-route-map)
3. [Quick Start](#-quick-start)
4. [Environment Variables](#-environment-variables)
5. [Available Scripts](#-available-scripts)
6. [Project Structure](#-project-structure)
7. [Wallet and Integration Notes](#-wallet-and-integration-notes)
8. [Testing and QA](#-testing-and-qa)
9. [Repository Notes](#-repository-notes)

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         NFTopia Frontend                           │
├─────────────────────────────────────────────────────────────────────┤
│ Next.js App Router                                                 │
│  app/[locale]/page.tsx        app/[locale]/marketplace             │
│  app/[locale]/auth            app/[locale]/creator-dashboard       │
├─────────────────────────────────────────────────────────────────────┤
│ UI Layer                                                            │
│  components/  features/  hooks/  stores/                           │
├─────────────────────────────────────────────────────────────────────┤
│ Integration Layer                                                   │
│  lib/graphql   lib/stellar   lib/firebase   lib/config             │
├─────────────────────────────────────────────────────────────────────┤
│ External Systems                                                    │
│  NFTopia backend REST + GraphQL   Stellar wallets   Soroban RPC    │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 PWA Update Strategy

The frontend uses `next-pwa` with `skipWaiting: true` configured. When a new version of the service worker is available, a non-intrusive banner appears at the bottom of the screen prompting the user to reload to get the latest version. Clicking the "Reload" button will activate the new service worker and refresh the page.

This ensures that users are prompted to update when a new version is deployed, while still allowing the update to occur automatically on a full page reload if the banner is dismissed.

## 🗺️ Route Map

Current top-level route areas include:

- `app/[locale]/page.tsx` for the main landing experience
- `app/[locale]/marketplace` for marketplace browsing
- `app/[locale]/creator-dashboard` for creator-oriented flows
- `app/[locale]/auth` for authentication and wallet callbacks
- `app/[locale]/add-nft-to-collection` for collection workflows
- `app/[locale]/TestImageUpload` and `test-responsive` for internal testing surfaces
- `app/offline` for offline/PWA support

## 🚀 Quick Start

```bash
cd nftopia-frontend
npm install
```

Create `.env.local` with the values your environment needs:

```env
NEXT_PUBLIC_BASE_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3001/graphql
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Required if you use Firebase-backed upload flows
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Run the dev server:

```bash
npm run dev
```

The app starts on `http://localhost:5000`.

## ⚙️ Environment Variables

The frontend currently reads these runtime values directly from code:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Canonical site URL for metadata generation |
| `NEXT_PUBLIC_API_URL` | REST base URL used by the app config |
| `NEXT_PUBLIC_GRAPHQL_URL` | GraphQL endpoint for Apollo client |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Stellar network selector |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client configuration for upload-related flows |

## 🛠️ Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server on port `5000` |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run Next lint |
| `npm run test` | Run Jest tests |
| `npm run graphql:codegen` | Generate GraphQL TypeScript artifacts |
| `npm run graphql:codegen:watch` | Watch GraphQL schema and regenerate types |
| `npm run validate-translations` | Validate locale file completeness |
| `npm run analyze` | Build with bundle analysis enabled |
| `npm run lighthouse` | Run Lighthouse CI against the configured budgets |

## 📁 Project Structure

```text
nftopia-frontend/
├── app/                     # App Router pages and layouts
├── components/              # Shared UI and wallet components
├── features/                # Feature-oriented modules
├── hooks/                   # React hooks
├── lib/
│   ├── config.ts            # Base REST and GraphQL configuration
│   ├── graphql/             # Apollo client and generated types
│   ├── stellar/             # Wallet and network integration
│   └── firebase/            # Firebase client configuration
├── locales/                 # EN, FR, ES, DE translation files
├── stores/                  # Zustand stores
├── scripts/                 # Translation validation helpers
├── QA-RESPONSIVENESS-CHECKLIST.md
└── RESPONSIVE_DESIGN_GUIDE.md
```

## 🔌 Wallet and Integration Notes

- The active wallet integration is Stellar-focused, with Freighter and Albedo support in the codebase.
- WalletConnect is present only as a placeholder message right now.
- The GraphQL client defaults to `http://localhost:3001/graphql` if not overridden.
- The REST config defaults to `http://localhost:9000` in code, so `NEXT_PUBLIC_API_URL` should be set explicitly for local development.

## 🧪 Testing and QA

```bash
npm run test
npm run validate-translations
```

### Manual Test Procedure for PWA Updates

1. Build the frontend: `npm run build`
2. Start the production server: `npm run start`
3. Visit the app in a supported browser (Chrome, Firefox, Edge) and ensure it loads.
4. Open the developer tools and go to the Application tab (or Service Workers in Firefox).
5. Simulate an update by changing something in the frontend (e.g., modify a text string) and rebuild.
6. Reload the page to trigger the service worker update.
7. Observe that a banner appears at the bottom of the screen with the message "Update available — refresh to get the latest version" and a "Reload" button.
8. Click the "Reload" button to verify that the page reloads and the new version is loaded.

You can also test by deploying a new version to a staging environment and visiting the site with an existing service worker.

Useful companion docs in this workspace:

- `QA-RESPONSIVENESS-CHECKLIST.md`
- `RESPONSIVE_DESIGN_GUIDE.md`
- `i18n-README.md`

## 📌 Repository Notes

- The active wallet, network, and backend integration code is aligned around Stellar and Soroban. Translation strings and UI copy reflect Stellar branding throughout.
- The project supports four locale folders: EN, FR, ES, and DE.

## 📦 Bundle Size Budgets

`.size-limit.js` configures automated bundle size budget enforcement using `size-limit` to prevent JavaScript and CSS regressions from landing unnoticed. Budgets are evaluated on every PR touching frontend code via the `.github/workflows/nftopia-frontend-bundle-size.yml` CI workflow and during the frontend build-and-verify pipeline.

All sizes are measured with **Brotli compression**, matching production CDN edge delivery to end-user browsers. Thresholds sit comfortably (~15–30%) above current baselines to prevent build flapping on routine copy or layout updates while promptly blocking unintentional heavy dependency inclusions.

| Chunk / Route Area | Target Pattern | Baseline (Brotli) | Budget Limit | Rationale |
| --- | --- | --- | --- | --- |
| Framework & Next.js Runtime | `framework-*.js`, `main-app-*.js`, `webpack-*.js` | ~40.3 kB | **55 kB** | Core React & Next.js runtime. Should remain lean and only change on framework upgrades. |
| Global Polyfills | `polyfills-*.js` | ~27.3 kB | **35 kB** | Browser backward-compatibility polyfill bundle. |
| Global Stylesheets (CSS) | `css/*.css` | ~14.4 kB | **25 kB** | Global Tailwind styles; guards against accidental inline assets or runaway utility bloat. |
| App Layouts (Root & Shared) | `app/**/layout-*.js` | ~18.9 kB | **28 kB** | Root and locale shells, common navigation, and context providers. |
| Landing / Home Page Route | `app/*/page-*.js`, `app/page-*.js` | ~14.1 kB | **22 kB** | Highest-traffic acquisition funnel landing surface. |
| Marketplace Browse Page | `app/*/marketplace/page-*.js` | ~13.2 kB | **20 kB** | Primary NFT marketplace browsing and catalog discovery interface. |
| Marketplace NFT Detail Page | `app/*/marketplace/*/page-*.js` | ~8.7 kB | **15 kB** | Item detail chunk; heavy media handling should be lazy-loaded. |
| Marketplace Auction Detail | `app/*/marketplace/auction/*/page-*.js` | ~8.7 kB | **15 kB** | Live auction detail chunk. |
| Marketplace Auctions List | `app/*/marketplace/auctions/page-*.js` | ~8.4 kB | **15 kB** | Auctions catalog chunk. |
| Collection Detail Page | `app/*/collection/*/page-*.js` | ~11.0 kB | **18 kB** | Creator collection galleries. |
| Creator Profile Page | `app/*/creator/*/page-*.js` | ~10.3 kB | **16 kB** | Public artist and creator profile pages. |
| Creator Dashboard Pages | `app/*/creator-dashboard/**/page-*.js` | ~52.7 kB | **75 kB** | Combined suite of creator tools (minting, collection creation, settings, sales). |
| Authentication Pages | `app/*/auth/**/page-*.js` | ~17.5 kB | **28 kB** | Stellar wallet authentication and login callbacks. |
| Account & Settings Pages | `app/*/account/**/page-*.js` | ~11.5 kB | **20 kB** | User privacy, wallet connections, and account preferences. |
| Total Client Static JavaScript | `chunks/**/*.js` | ~1.09 MB | **1.35 MB** | Hard ceiling on cumulative client-shipped JavaScript across all lazy chunks and vendor dependencies. |

### Running Locally

```bash
# Build production assets first
npm run build

# Run budget verification
npm run size-limit
# or
npm run check-bundle-size
```

### How to Adjust Budgets When Legitimate Increases Are Needed

When a new feature or dependency genuinely requires expanding a bundle size budget:

1. **Analyze the bundle composition**:
   ```bash
   npm run analyze
   ```
   This generates an interactive visual dependency treemap at `nftopia-frontend/.next/analyze/client.html`. Open this file in your browser to inspect exact package footprints.

2. **Verify optimization best practices before raising limits**:
   - **Tree shaking**: Ensure packages support ESM tree-shaking and use named imports (e.g., `import { format } from 'date-fns'` or subpath imports rather than monolithic barrel imports).
   - **Code splitting**: Lazy-load heavy dependencies, dialog modals, or charts using `next/dynamic` with `ssr: false` if not needed during initial paint.
   - **Redundant dependencies**: Check for duplicate packages (e.g., multiple UUID or date libraries).

3. **Update the budget in `.size-limit.js`**:
   Adjust the specific route or chunk `limit` in `nftopia-frontend/.size-limit.js` to accommodate the measured baseline plus appropriate headroom (~15–20%).

4. **Document the change in your PR**:
   Reference the specific route budget adjusted, include the before/after bundle size, and explain why the dependency or code addition is required.

## 🚦 Lighthouse Budgets

`lighthouserc.js` turns Lighthouse into a merge gate for the three highest-traffic
surfaces: the landing page (`/`), marketplace browse (`/en/marketplace`) and NFT
detail (`/en/marketplace/1`). `npm run lighthouse` starts the production build on
port 5000 and asserts the budgets below; set `LHCI_BASE_URL` to run the same
budgets against a deployed preview instead.

| Budget | Threshold | Severity | Why |
| --- | --- | --- | --- |
| `categories:performance` | >= 0.80 | error | Floor for the heaviest asset pages; below this the marketplace grid feels broken on mid-tier mobile. |
| `categories:accessibility` | >= 0.90 | error | The marketplace is a WCAG-relevant surface and already ships a11y-oriented components; regressions must block. |
| `categories:best-practices` | >= 0.90 | warn | Useful signal, but noisy for a Stellar dapp (wallet extensions, third-party scripts). |
| `categories:seo` | >= 0.90 | error on `/` + `/en/marketplace`, warn on NFT detail | Locale-aware metadata is a product requirement; a broken `generateMetadata` should fail CI. The detail route renders API data, which is unavailable during `lhci autorun`, so its crawlability is advisory (see below). |
| `largest-contentful-paint` | <= 2500 ms | error | Core Web Vitals good boundary (75th percentile). |
| `cumulative-layout-shift` | <= 0.1 | error | Core Web Vitals good boundary; the grid/marketplace cards are the usual culprit. |
| `total-blocking-time` | <= 200 ms | error | Lab proxy for INP, which has no lab metric of its own. |
| `first-contentful-paint` | <= 2000 ms | warn | Leading indicator for LCP; warns early rather than failing on its own. |
| `interactive` | <= 3500 ms | warn | Legacy TTI signal, kept advisory. |
| `speed-index` | <= 3400 ms | warn | Advisory visual-completeness signal. |
| `uses-responsive-images` | 0 oversized | warn | The marketplace serves user media; an unsized hero is an easy regression. |
| `unsized-images` | 0 | error | Unsized media is the single most common CLS regression in this codebase. |

Thresholds sit slightly below each page's current baseline so ordinary noise does
not fail unrelated PRs, while a real regression still trips the gate. Every run is
the median of three passes to avoid one slow run flapping the build.

`lhci autorun` starts the frontend on its own, without the GraphQL API, so the NFT
detail route (`/en/marketplace/1`) renders its not-found shell there. That shell is
deliberately `noindex`, and `is-crawlable` alone carries a 4.0 weight in the SEO
category, so the detail URL is held to every performance/accessibility/Core Web
Vitals budget but its SEO score is reported as a warning rather than a failure. The
per-URL split lives in `assertMatrix` in `lighthouserc.js`; the rendered route itself
is covered by the e2e suite.

Crawler files are real routes: `app/robots.ts` serves `/robots.txt` and
`app/sitemap.ts` serves `/sitemap.xml`. Before them, `/robots.txt` fell through to
the `[locale]` dynamic segment and returned the app shell HTML, which is what the
`robots-txt` audit flags as "robots.txt is not valid".
