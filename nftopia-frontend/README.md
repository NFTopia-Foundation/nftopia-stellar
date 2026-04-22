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

Useful companion docs in this workspace:

- `QA-RESPONSIVENESS-CHECKLIST.md`
- `RESPONSIVE_DESIGN_GUIDE.md`
- `i18n-README.md`

## 📌 Repository Notes

- Some translation copy and older implementation artifacts still mention Starknet. The active wallet, network, and backend integration code is now aligned around Stellar and Soroban.
- The project supports four locale folders: EN, FR, ES, and DE.