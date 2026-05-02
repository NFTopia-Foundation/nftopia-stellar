# NFTopia Backend
**Stellar API Gateway and Marketplace Services**

![NestJS](https://img.shields.io/badge/NestJS-11-e0234e)
![GraphQL](https://img.shields.io/badge/GraphQL-Apollo-e10098)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791)
![Redis](https://img.shields.io/badge/Redis-Cache-d82c20)
![Stellar](https://img.shields.io/badge/Stellar-Soroban-111827)
![Swagger](https://img.shields.io/badge/Swagger-REST%20Docs-85ea2d)

NFTopia Backend is the service backbone of the platform. It owns authentication, NFT and collection management, marketplace workflows, contract-facing services, decentralized storage integration, search, and API documentation. The app exposes a REST API on port `3000` and a separate GraphQL gateway on port `3001` from the same codebase.

## 🌟 Key Features

- **REST API with global versioning** via `/api/v1`
- **GraphQL sidecar** on `/graphql`
- **Swagger docs** exposed from the REST app at `/api/docs`
- **Stellar wallet authentication** with challenge and signature verification
- **Marketplace modules** for NFTs, collections, listings, auctions, bids, and orders
- **Redis-backed cache and rate guard**
- **Meilisearch integration** for NFT and profile discovery
- **IPFS and Arweave storage support** for decentralized asset persistence

## 📋 Table of Contents

1. [Architecture](#-architecture)
2. [Module Map](#-module-map)
3. [Quick Start](#-quick-start)
4. [Environment Configuration](#-environment-configuration)
5. [Available Scripts](#-available-scripts)
6. [API Surface](#-api-surface)
7. [Project Structure](#-project-structure)
8. [Testing and Quality](#-testing-and-quality)
9. [Security Notes](#-security-notes)

## 🏗️ Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                           NFTopia Backend                           │
├──────────────────────────────────────────────────────────────────────┤
│ REST API (:3000)                                                    │
│  /api/v1/auth  /nfts  /collections  /listings  /auctions  /orders   │
│  /bids  /users  /search  /admin                                      │
├──────────────────────────────────────────────────────────────────────┤
│ GraphQL Gateway (:3001/graphql)                                     │
│  Apollo Server + Nest GraphQL schema factory                        │
├──────────────────────────────────────────────────────────────────────┤
│ Core Services                                                        │
│  Auth | Soroban RPC | Stellar account transforms | storage | search │
├─────────────────────┬─────────────────────────┬──────────────────────┤
│ PostgreSQL          │ Redis                   │ Meilisearch          │
│ entities + records  │ cache + rate limit      │ discovery index       │
├─────────────────────┴─────────────────────────┴──────────────────────┤
│ External systems: Soroban RPC, Stellar network, IPFS, Arweave       │
└──────────────────────────────────────────────────────────────────────┘
```

## 🧩 Module Map

| Area | Responsibility |
| --- | --- |
| `src/auth` | Email auth, Stellar wallet challenge/verify, JWT, wallet session management |
| `src/modules/nft` | NFT listing, minting, metadata updates, burn, attributes |
| `src/modules/collection` | Collection CRUD, stats, top collections, NFTs per collection |
| `src/modules/listing` | Marketplace listings, buy flow, cancel flow |
| `src/modules/auction` | Auction creation, bids, settlement, cancellation |
| `src/modules/bid` | Bid-specific resources and operations |
| `src/modules/order` | Order lifecycle handling |
| `src/storage` | IPFS and Arweave integration |
| `src/search` | Search controller and Meilisearch-backed discovery |
| `src/graphql` | GraphQL schema, resolvers, middleware, context factory |
| `src/services` | Soroban RPC and Stellar response transformation services |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL and Redis access, either local or containerized

### Local Setup

```bash
cd nftopia-backend
npm install
cp .env.example .env

# docker-compose.yml reads these values directly
printf '\nDB_USER=postgres\nDB_PASSWORD=postgres\nDB_NAME=nftopia\nDB_HOST=localhost\nDB_PORT=5433\n' >> .env

# match the container port mapping
sed -i 's|localhost:5432|localhost:5433|' .env

docker compose up -d
npm run start:dev
```

After startup:

- REST base: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`
- GraphQL: `http://localhost:3001/graphql`

## ⚙️ Environment Configuration

The provided `.env.example` includes the main runtime knobs. The most important ones for local development are below.

```env
PORT=3000
GRAPHQL_PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5000

DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=nftopia
DB_HOST=localhost
DB_PORT=5433
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nftopia

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=replace-this-for-real-environments
JWT_EXPIRES_IN_SECONDS=900
JWT_REFRESH_EXPIRES_IN_SECONDS=604800

STELLAR_NETWORK=testnet
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

IPFS_PROVIDER=pinata
IPFS_GATEWAY_URL=https://ipfs.io/ipfs
STORAGE_FALLBACK_ENABLED=true
```

Notes:

- `docker-compose.yml` uses `DB_USER`, `DB_PASSWORD`, and `DB_NAME` directly, so those must exist even if `DATABASE_URL` is set.
- The default example file points PostgreSQL at port `5432`, but the compose file exposes it on `5433`.

## 🛠️ Available Scripts

| Command | Description |
| --- | --- |
| `npm run start` | Start the Nest app |
| `npm run start:dev` | Start in watch mode |
| `npm run start:debug` | Start in debug watch mode |
| `npm run build` | Build the TypeScript project |
| `npm run start:prod` | Run the compiled output |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:cov` | Generate coverage |
| `npm run lint` | Run ESLint with fixes |
| `npm run format` | Format source and test files |

## 🔌 API Surface

Swagger is the best source of truth for exact mounted routes, but the primary controller surfaces are:

| Domain | Main Routes |
| --- | --- |
| Auth | `auth/register`, `auth/email/login`, `auth/wallet/challenge`, `auth/wallet/verify`, wallet link and session management |
| NFTs | `nfts`, `nfts/:id`, `nfts/token/:tokenId`, `nfts/owner/:ownerId`, `nfts/collection/:collectionId` |
| Collections | collection listing, top collections, stats, per-collection NFT access, create and update |
| Listings | list, active, detail, create, cancel, buy |
| Auctions | list, active, detail, bids, create, place bid, settle, cancel |
| Search | `search` for NFTs and profiles |
| Admin / Users / Orders / Bids | Additional operational and domain-specific controllers |

### GraphQL Health Example

```bash
curl -X POST http://localhost:3001/graphql \
  -H "content-type: application/json" \
  --data '{"query":"query { health { status service timestamp } }"}'
```

## 📁 Project Structure

```text
nftopia-backend/
├── migrations/              # SQL migrations for marketplace tables
├── src/
│   ├── admin/               # Admin-facing module
│   ├── auth/                # Email + Stellar wallet authentication
│   ├── common/              # Filters, guards, shared helpers
│   ├── config/              # Runtime configuration
│   ├── graphql/             # GraphQL schema and context
│   ├── modules/             # NFT, collection, listing, auction, order, bid
│   ├── search/              # Meilisearch-backed discovery
│   ├── services/            # Soroban RPC and Stellar account services
│   ├── storage/             # IPFS and Arweave adapters
│   └── users/               # User entity and controller
├── docker-compose.yml       # Postgres, Redis, Meilisearch
├── README-SETUP.md          # Older setup notes
└── package.json             # Scripts and dependencies
```

## 🧪 Testing and Quality

```bash
npm run test
npm run test:e2e
npm run test:cov
npm run lint
```

The codebase is configured with Jest, ESLint, Prettier, and strict TypeScript support.

## 🔐 Security Notes

- Stellar wallet verification is handled through challenge and signature checks.
- JWT guards protect authenticated routes.
- Request logging uses Pino with sensitive header redaction.
- A Redis-backed guard provides rate limiting support.
- The service currently uses TypeORM `synchronize: true`; that is acceptable for development only and should be replaced with migration-driven schema control for production.