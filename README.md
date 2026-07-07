<p align="center">
  <img src="nftopia-frontend/public/nftopia-04.svg" alt="NFTopia" width="420" />
</p>

# NFTopia
**Stellar NFT Marketplace Monorepo**

![Next.js](https://img.shields.io/badge/Next.js-Web-black)
![NestJS](https://img.shields.io/badge/NestJS-API-e0234e)
![Expo](https://img.shields.io/badge/Expo-Mobile-1b1f23)
![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-0f766e)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Data-336791)
![Redis](https://img.shields.io/badge/Redis-Cache-d82c20)

NFTopia is a full-stack NFT platform built around Stellar and Soroban. This monorepo contains the public web marketplace, the NestJS API and integration layer, the Expo mobile app, a lightweight admin surface, and a Soroban smart-contract workspace. The goal is to deliver creator tooling, marketplace flows, wallet-based authentication, decentralized asset storage, and on-chain settlement from a single repository.

## 🌟 Key Features

- **Multi-Surface Product** - Separate web, mobile, admin, backend, and contract workspaces with a shared marketplace domain.
- **Stellar-Native Authentication** - Supports Stellar wallet challenge and signature verification alongside email/password auth in the backend.
- **Marketplace Core** - NFT minting, collections, listings, auctions, bids, orders, and search are implemented in the service layer.
- **Hybrid Data Plane** - PostgreSQL, Redis, Meilisearch, IPFS, and Arweave are used together for persistence, cache, discovery, and asset storage.
- **Localized Web UX** - The frontend uses locale-based routing and translation validation for EN, FR, ES, and DE.
- **Soroban Contract Workspace** - Rust contracts cover collection creation, marketplace settlement, and transaction orchestration.

## 📋 Table of Contents

1. [System Architecture](#-system-architecture)
2. [Repository Structure](#-repository-structure)
3. [Apps and Services](#-apps-and-services)
4. [Quick Start](#-quick-start)
5. [Development Workflow](#-development-workflow)
6. [API and Integration Surfaces](#-api-and-integration-surfaces)
7. [Testing and Quality](#-testing-and-quality)
8. [Security and Operational Notes](#-security-and-operational-notes)
9. [Repository Notes](#-repository-notes)
10. [Contributing](#-contributing)

## 🏗️ System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                            NFTopia Platform Stack                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Client Layer                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐ │
│  │ nftopia-frontend      │  │ nftopia-mobile-app   │  │ nftopia-admin    │ │
│  │ Next.js marketplace   │  │ Expo React Native    │  │ Vite admin shell │ │
│  │ Locale routing + PWA  │  │ Wallet create/import │  │ Ops UI scaffold  │ │
│  └────────────┬──────────┘  └────────────┬──────────┘  └────────┬─────────┘ │
│               │                          │                      │           │
├───────────────▼──────────────────────────▼──────────────────────▼───────────┤
│ Service Layer: nftopia-backend                                               │
│  REST API (/api/v1) | Swagger (/api/docs) | GraphQL gateway (:3001/graphql) │
│  Auth | NFTs | Collections | Listings | Auctions | Bids | Orders | Search   │
├───────────────┬──────────────────────────┬───────────────────────┬──────────┤
│               │                          │                       │          │
│               ▼                          ▼                       ▼          │
│      PostgreSQL persistence         Redis cache/rate limit   Meilisearch   │
│      users, NFTs, collections       session/cache guards     discovery      │
│      listings, bids, orders         app-level TTL storage    fuzzy search   │
│                                                                          │
├───────────────┬───────────────────────────────────────────────┬────────────┤
│               ▼                                               ▼            │
│      IPFS / Arweave asset storage                     Stellar / Soroban     │
│      metadata, files, fallback storage               contract execution     │
│      and retrieval                                   collection + market    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 📁 Repository Structure

```text
nftopia-stellar/
├── nftopia-admin/          # React + Vite admin dashboard scaffold
├── nftopia-backend/        # NestJS API, GraphQL sidecar, storage, search
├── nftopia-frontend/       # Next.js marketplace, wallet UX, localization
├── nftopia-mobile-app/     # Expo mobile app with auth and wallet flows
├── nftopia-stellar/        # Soroban contract workspace and deployment scripts
└── README.md               # Monorepo overview
```

## 🧩 Apps and Services

| Workspace | Role | Current State |
| --- | --- | --- |
| `nftopia-frontend` | Public web marketplace and creator UI | Actively structured around Stellar wallet flows, PWA support, and i18n |
| `nftopia-backend` | Core API, GraphQL gateway, data layer, storage integrations | Primary service plane for marketplace operations |
| `nftopia-mobile-app` | Native mobile UX for onboarding, wallet import, and app navigation | Solid navigation/auth foundation with Stellar wallet services |
| `nftopia-admin` | Internal operations dashboard | UI scaffold is ready, feature modules still need implementation |
| `nftopia-stellar` | Soroban smart-contract workspace | Collection, settlement, and transaction packages exist; NFT package is still scaffold-level |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 10+ or pnpm 10+
- Docker and Docker Compose
- Rust toolchain with `wasm32-unknown-unknown`
- Soroban CLI for contract deployment

### 1. Start the backend dependencies

```bash
cd nftopia-backend
cp .env.example .env

# docker-compose.yml expects these values explicitly
printf '\nDB_USER=postgres\nDB_PASSWORD=postgres\nDB_NAME=nftopia\nDB_HOST=localhost\nDB_PORT=5433\n' >> .env

# align DATABASE_URL with the compose port mapping
sed -i 's|localhost:5432|localhost:5433|' .env

docker compose up -d
npm install
npm run start:dev
```

REST API: `http://localhost:3000/api/v1`

Swagger: `http://localhost:3000/api/docs`

GraphQL: `http://localhost:3001/graphql`

### 2. Start the web frontend

```bash
cd ../nftopia-frontend
npm install
cat > .env.local <<'EOF'
NEXT_PUBLIC_BASE_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3001/graphql
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
EOF

npm run dev
```

Web app: `http://localhost:5000`

### 3. Start the mobile app

```bash
cd ../nftopia-mobile-app
npm install
npm start
```

Then run `npm run android`, `npm run ios`, or open the Expo QR flow.

### 4. Start the admin dashboard

```bash
cd ../nftopia-admin
npm install
npm run dev
```

### 5. Build or test the Soroban workspace

```bash
cd ../nftopia-stellar
rustup target add wasm32-unknown-unknown
cargo build --workspace
cargo test --workspace
```

## 🔄 Development Workflow

1. Bring up the backend first, because the web and mobile clients depend on its REST and GraphQL surfaces.
2. Start the frontend on port `5000` for browser-based wallet and creator flows.
3. Start the mobile app separately with Expo when validating onboarding and secure wallet flows.
4. Use the admin app as an internal surface for future moderation and operations modules.
5. Build and test contracts independently from the app layer when evolving Soroban logic.

## 🔌 API and Integration Surfaces

| Surface | Default URL | Purpose |
| --- | --- | --- |
| REST API | `http://localhost:3000/api/v1` | Primary application API for auth, NFTs, collections, auctions, listings, orders, users, and search |
| Swagger | `http://localhost:3000/api/docs` | Interactive REST documentation generated from Nest decorators |
| GraphQL | `http://localhost:3001/graphql` | Secondary query surface and health endpoint |
| Search | REST `search` controller | NFT and profile discovery backed by Meilisearch |
| Soroban RPC | Configured via env | Backend and frontend contract interaction |

## 🧪 Testing and Quality

```bash
# Backend
cd nftopia-backend && npm test

# Frontend
cd ../nftopia-frontend && npm test

# Mobile
cd ../nftopia-mobile-app && npm test

# Contracts
cd ../nftopia-stellar && cargo test --workspace
```

Additional quality scripts:

- Frontend i18n validation: `npm run validate-translations`
- Frontend GraphQL types: `npm run graphql:codegen`
- Backend linting: `npm run lint`
- Admin linting: `npm run lint`

## 🔐 Security and Operational Notes

- The backend supports Stellar wallet challenge verification and JWT-based protected routes.
- Redis-backed guards are used for application-level rate limiting and cache TTL handling.
- Pino logging redacts sensitive request headers such as authorization and cookies.
- Asset storage is designed with IPFS-first configuration and optional Arweave fallback.
- The backend currently uses TypeORM `synchronize: true`, which is convenient for development but should be replaced with an explicit migration workflow before production rollout.

## 📌 Repository Notes

- Some UI copy and translation strings in the web and mobile projects still reference legacy Starknet terminology. The active integration code is Stellar/Soroban-focused.
- `nftopia-admin` is intentionally lightweight right now; it is a prepared shell rather than a completed operations suite.
- `nftopia-stellar/contracts/nft_contract` is present but still scaffolded compared with the more developed `collection_factory`, `marketplace_settlement`, and `transaction_contract` packages.

## 🤝 Contributing

1. Create a feature branch.
2. Keep changes scoped to the workspace you are modifying.
3. Run the local test or lint command for that workspace before opening a PR.
4. Update the relevant README when setup, architecture, or operational behavior changes.

For deeper setup details, use the workspace-level READMEs in each project folder.