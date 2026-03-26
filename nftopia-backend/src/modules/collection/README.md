# Collection Module

## Overview
The Collection module manages NFT collections in the nftopia-backend application. It provides REST API endpoints for creating, viewing, and managing NFT collections with statistics tracking.

## Features
- Create new NFT collections
- View collection details and metadata
- Get collection statistics (floor price, volume, owners)
- List top collections by volume
- Retrieve NFTs within a collection
- Update collection metadata (creator only)
- Pagination and filtering support

## API Endpoints

### GET /api/v1/collections
List all collections with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search by name, symbol, or description
- `creatorId` (optional): Filter by creator UUID
- `isVerified` (optional): Filter by verification status
- `sortBy` (optional): Sort field (createdAt, totalVolume, floorPrice, name)
- `sortOrder` (optional): Sort order (ASC, DESC)

**Response:**
```json
{
  "data": [Collection[]],
  "total": number,
  "page": number,
  "limit": number
}
```

### GET /api/v1/collections/:id
Get a specific collection by ID.

**Response:** Collection object

### GET /api/v1/collections/contract/:address
Get a collection by contract address.

**Response:** Collection object

### GET /api/v1/collections/:id/stats
Get collection statistics.

**Response:**
```json
{
  "totalSupply": number,
  "floorPrice": string,
  "totalVolume": string,
  "owners": number,
  "listedCount": number
}
```

### GET /api/v1/collections/top
Get top collections by volume.

**Query Parameters:**
- `limit` (optional): Number of collections (default: 10)

**Response:** Collection[]

### GET /api/v1/collections/:id/nfts
Get NFTs in a collection with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "data": [Nft[]],
  "total": number,
  "page": number,
  "limit": number
}
```

### POST /api/v1/collections
Create a new collection (requires authentication).

**Request Body:**
```json
{
  "name": "string (required, max 255)",
  "symbol": "string (required, max 50)",
  "description": "string (optional)",
  "imageUrl": "string (optional, valid URL)",
  "bannerImageUrl": "string (optional, valid URL)",
  "contractAddress": "string (optional, 56 chars)"
}
```

**Response:** Created Collection object

### PUT /api/v1/collections/:id
Update collection metadata (requires authentication, creator only).

**Request Body:**
```json
{
  "name": "string (optional)",
  "symbol": "string (optional)",
  "description": "string (optional)",
  "imageUrl": "string (optional)",
  "bannerImageUrl": "string (optional)"
}
```

**Response:** Updated Collection object

## Database Schema

```sql
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_address VARCHAR(56) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    banner_image_url VARCHAR(500),
    creator_id UUID NOT NULL REFERENCES users(id),
    total_supply INTEGER DEFAULT 0,
    floor_price DECIMAL(20,7),
    total_volume DECIMAL(20,7) DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

Run tests with:
```bash
npm test -- collection.controller.spec.ts
npm test -- collection.service.spec.ts
```

## Usage Example

```typescript
// Create a collection
const collection = await collectionService.create({
  name: 'My NFT Collection',
  symbol: 'MNC',
  description: 'A collection of unique NFTs',
  imageUrl: 'https://example.com/image.png'
}, userId);

// Get collection stats
const stats = await collectionService.getStats(collectionId);

// List top collections
const topCollections = await collectionService.getTopCollections(10);
```

## Security
- Only authenticated users can create collections
- Only the collection creator can update collection metadata
- Contract addresses are validated for uniqueness
- All inputs are validated using class-validator

## Notes
- Contract addresses are auto-generated if not provided
- Floor price is calculated from listed NFTs
- Statistics are computed in real-time from NFT data
- Pagination is enforced with a maximum limit of 100 items
