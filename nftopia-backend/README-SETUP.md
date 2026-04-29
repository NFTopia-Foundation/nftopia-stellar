# NFTopia Backend

A scalable NestJS backend for the NFTopia NFT marketplace platform. This service provides API endpoints for user management, NFT operations, collections, and marketplace features integrated with Stellar/Soroban smart contracts.

## Features

- ✨ RESTful API with global `/api/v1` prefix
- 🔒 CORS enabled for frontend integration
- 🏥 Health check endpoint
- 🛠️ Environment configuration support
- 📦 Modular NestJS architecture
- 🧪 Jest testing setup
- 🔧 ESLint configuration
- 📝 TypeScript strict mode

## Prerequisites

- Node.js v18 or higher
- npm or pnpm

## Installation

1. Navigate to the backend directory:
```bash
cd nftopia-backend
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Configure environment variables:
```bash
# Copy the example configuration
cp .env.example .env
```

Then update `.env` with your configuration:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3001
```

## Running the Application

### Development Mode
```bash
npm run start:dev
# or
pnpm start:dev
```

The application will start in watch mode and automatically reload on file changes.

### Production Build
```bash
npm run build
npm run start:prod
# or
pnpm build
pnpm start:prod
```

### Debug Mode
```bash
npm run start:debug
# or
pnpm start:debug
```

## API Endpoints

### Health Check
- **Endpoint:** `GET /api/v1/health`
- **Description:** Returns the health status of the API server
- **Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-01-21T12:00:00.000Z"
}
```

**Example using curl:**
```bash
curl http://localhost:3000/api/v1/health
```

**Example using Postman:**
1. Create a new GET request
2. Enter URL: `http://localhost:3000/api/v1/health`
3. Click Send
4. You should receive a 200 OK response with the JSON body above

### NFT Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/nfts` | List NFTs (pagination, owner/collection/search filters) | Optional |
| GET | `/api/v1/nfts/:id` | Get NFT by ID | Optional |
| GET | `/api/v1/nfts/token/:tokenId` | Get NFT by token ID | Optional |
| GET | `/api/v1/nfts/owner/:ownerId` | Get NFTs by owner | Optional |
| GET | `/api/v1/nfts/collection/:collectionId` | Get NFTs by collection | Optional |
| POST | `/api/v1/nfts` | Mint new NFT | Required |
| PUT | `/api/v1/nfts/:id` | Update NFT metadata | Required |
| DELETE | `/api/v1/nfts/:id` | Burn NFT (soft-delete) | Required |
| GET | `/api/v1/nfts/:id/attributes` | Get NFT attributes | Optional |

## Project Structure

```
nftopia-backend/
├── src/
│   ├── app.controller.ts      # Main API controller
│   ├── app.service.ts         # Main service logic
│   ├── app.module.ts          # Root module
│   └── main.ts                # Application entry point
├── test/                      # E2E tests
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── nest-cli.json              # NestJS CLI configuration
├── eslint.config.mjs          # ESLint rules
├── .env.example               # Example environment variables
└── README.md                  # This file
```

## Testing

### Unit Tests
```bash
npm run test
# or
pnpm test
```

### Watch Mode
```bash
npm run test:watch
# or
pnpm test:watch
```

### Coverage Report
```bash
npm run test:cov
# or
pnpm test:cov
```

### E2E Tests
```bash
npm run test:e2e
# or
pnpm test:e2e
```

## Development Commands

### Linting
```bash
npm run lint
# or
pnpm lint
```

### Code Formatting
```bash
npm run format
# or
pnpm format
```

## Configuration

### Environment Variables

The application supports the following environment variables via the `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port on which the server listens |
| `NODE_ENV` | `development` | Environment mode (development/production) |
| `CORS_ORIGIN` | `http://localhost:3001` | Allowed CORS origin for frontend requests |
| `MEILISEARCH_HOST` | `http://127.0.0.1:7700` | MeiliSearch HTTP endpoint for NFT/profile discovery |
| `MEILISEARCH_API_KEY` | `` | Optional MeiliSearch API key / master key |

### Adding New Modules

To add a new feature module:

```bash
npx @nestjs/cli generate module features/your-module
npx @nestjs/cli generate controller features/your-module
npx @nestjs/cli generate service features/your-module
```

## Performance & Scalability

- **Modular Architecture:** Features are organized into separate modules for easy maintenance and scaling
- **Global Prefix:** All routes use `/api/v1` prefix for versioning
- **CORS Handling:** Properly configured CORS prevents cross-origin issues
- **Error Handling:** Centralized exception handling through NestJS filters

## Future Enhancements

- [ ] Database integration (PostgreSQL with TypeORM)
- [ ] Authentication & JWT tokens
- [ ] Stellar/Soroban smart contract integration
- [ ] API rate limiting
- [ ] Request logging and monitoring
- [ ] Caching layer (Redis)
- [ ] Message queues (BullMQ)
- [ ] API documentation (Swagger/OpenAPI)

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, change it via:
```bash
PORT=3001 npm run start:dev
```

### Module Not Found Error
Ensure all dependencies are installed:
```bash
rm -rf node_modules
npm install
```

### TypeScript Compilation Errors
Clear the build cache:
```bash
rm -rf dist
npm run build
```

## Contributing

When adding new features:
1. Create a new branch: `git checkout -b feat/your-feature`
2. Follow the NestJS best practices
3. Add unit tests for new functionality
4. Ensure all tests pass: `npm run test`
5. Format code: `npm run format`
6. Submit a pull request

## License

UNLICENSED - Internal use only

## Support

For issues or questions about the backend setup, please create an issue in the repository or contact the team.

## Next Steps

1. ✅ Health check endpoint is running
2. 📦 Set up database integration (PostgreSQL + TypeORM)
3. 🔐 Implement authentication (JWT)
4. 🌐 Connect to Stellar/Soroban contracts
5. 📚 Generate API documentation with Swagger
6. 🧪 Expand test coverage
