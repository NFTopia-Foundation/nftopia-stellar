# NFTopia Backend API

A scalable NestJS backend for the NFTopia NFT marketplace platform. This service provides API endpoints for user management, NFT operations, collections, and marketplace features integrated with Stellar/Soroban smart contracts.

## 🚀 Features

- ✨ RESTful API with global `/api/v1` prefix
- �️ Embedded GraphQL gateway sidecar on `/graphql`
- 🔒 CORS enabled for frontend integration
- 🏥 REST and GraphQL health checks
- 🛠️ Environment configuration support
- 📦 Modular NestJS architecture
- 🧪 Jest testing setup
- 🔧 ESLint configuration
- 📝 TypeScript strict mode

## 📋 Prerequisites

- Node.js v18 or higher
- npm or pnpm

## ⚡ Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Update .env with your settings (optional, defaults work fine)
```

### 3. Start Development Server

```bash
npm run start:dev
```

The backend starts two HTTP servers in the same Nest.js process:
- REST API: `http://localhost:3000`
- GraphQL gateway: `http://localhost:3001/graphql`

### 4. Test Health Endpoints

REST health check:

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2026-01-21T12:00:00.000Z"
}
```

GraphQL health check:

```bash
curl -X POST http://localhost:3001/graphql \
  -H "content-type: application/json" \
  --data '{"query":"query { health { status service timestamp } }"}'
```

Expected response:
```json
{
  "data": {
    "health": {
      "status": "ok",
      "service": "graphql-gateway",
      "timestamp": "2026-03-25T13:32:46.566Z"
    }
  }
}
```

## 📚 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start the server in production mode |
| `npm run start:dev` | Start the server in development mode (with watch) |
| `npm run start:debug` | Start the server in debug mode |
| `npm run start:prod` | Run production build |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Generate test coverage report |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Run ESLint linter |
| `npm run format` | Format code with Prettier |

## 📁 Project Structure

```
nftopia-backend/
├── src/
│   ├── app.controller.ts       # Main API controller
│   ├── app.service.ts          # Main service logic
│   ├── app.module.ts           # Root module
│   ├── main.ts                 # Application entry point
│   └── [features]/             # Feature modules (to be added)
├── test/                       # E2E test files
├── dist/                       # Compiled output (generated)
├── node_modules/               # Dependencies (generated)
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── nest-cli.json               # NestJS CLI config
├── .env                        # Environment variables (local)
├── .env.example                # Example environment variables
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

## 🔧 Environment Variables

Edit `.env` to configure:

```env
# REST Server
PORT=3000
NODE_ENV=development

# GraphQL Gateway
GRAPHQL_PORT=3001
GRAPHQL_PLAYGROUND_ENABLED=true
GRAPHQL_INTROSPECTION_ENABLED=true

# CORS Configuration
CORS_ORIGIN=http://localhost:3001
```

### Core Application Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nftopia

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN_SECONDS=900
JWT_REFRESH_EXPIRES_IN_SECONDS=604800

# Stellar/Soroban
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK=testnet
SOROBAN_EVENT_CONTRACT_IDS=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## 📡 API Endpoints

### REST Health Check
- **GET** `/api/v1/health`
- **Response:**
  ```json
  {
    "status": "OK",
    "timestamp": "2026-01-21T12:00:00.000Z"
  }
  ```

### GraphQL Gateway
- **URL:** `http://localhost:3001/graphql`
- **Playground:** available in development when `GRAPHQL_PLAYGROUND_ENABLED=true`
- **Health Query:**
  ```graphql
  query {
    health {
      status
      service
      timestamp
    }
  }
  ```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

## 🔍 Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## 🏗️ Project Architecture

This NestJS backend follows enterprise-grade architecture patterns:

- **Modular Design:** Features are organized into separate modules
- **Global Prefix:** All REST API routes use `/api/v1` for versioning
- **Dual Transport Setup:** REST runs on port `3000` while GraphQL gateway runs on port `3001`
- **CORS Handling:** Configured to work with the frontend origin defined in `.env`
- **Environment Configuration:** Externalize all configuration to `.env`
- **TypeScript:** Full type safety with strict mode

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm run start:prod
```

The compiled code will be in the `dist/` directory.

### Environment for Production
```env
PORT=3000
GRAPHQL_PORT=3001
NODE_ENV=production
GRAPHQL_PLAYGROUND_ENABLED=false
GRAPHQL_INTROSPECTION_ENABLED=false
CORS_ORIGIN=https://your-frontend-domain.com
```

## 🔐 Security Considerations

- [ ] Enable rate limiting
- [ ] Add request validation
- [ ] Implement authentication (JWT)
- [ ] Add HTTPS in production
- [ ] Setup API key management
- [ ] Enable request logging

## 📦 Adding New Features

### Create a New Module

```bash
npx @nestjs/cli generate module features/your-feature
npx @nestjs/cli generate controller features/your-feature
npx @nestjs/cli generate service features/your-feature
```

### Module Structure Example

```
src/features/nft/
├── nft.module.ts
├── nft.controller.ts
├── nft.service.ts
├── dto/
│   ├── create-nft.dto.ts
│   └── update-nft.dto.ts
├── entities/
│   └── nft.entity.ts
└── nft.controller.spec.ts
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Use different REST and GraphQL ports
PORT=3000 GRAPHQL_PORT=3002 npm run start:dev
```

### Dependencies Not Installed
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
```bash
# Clear build and rebuild
rm -rf dist
npm run build
```

### ESLint Issues
```bash
npm run lint
npm run format
```

## 📝 Commit Convention

Use conventional commits:
```
feat: add new feature
fix: fix a bug
docs: update documentation
test: add tests
refactor: refactor code
chore: maintenance tasks
```

Example: `feat: initialize nestjs backend with basic configuration and health check`

## 🎯 Roadmap

- [x] Initialize NestJS project
- [x] Configure global prefix and CORS
- [x] Create health check endpoint
- [ ] Setup database (PostgreSQL + TypeORM)
- [ ] Implement authentication (JWT)
- [ ] Create NFT module
- [ ] Create user module
- [ ] Integrate Stellar/Soroban contracts
- [ ] Add API documentation (Swagger)
- [ ] Setup CI/CD pipeline
- [ ] Add monitoring and logging

## 📖 Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [NestJS Best Practices](https://docs.nestjs.com/techniques/database)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Stellar Documentation](https://developers.stellar.org)

## 📄 License

UNLICENSED - Internal use only

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Follow NestJS best practices
3. Write tests for new features
4. Run linter: `npm run lint`
5. Format code: `npm run format`
6. Commit with conventional message
7. Push and create a pull request

## ❓ Support

For questions or issues, please open an issue in the repository.
