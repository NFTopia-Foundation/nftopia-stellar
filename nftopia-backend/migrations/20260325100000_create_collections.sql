-- Create collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "isHidden" BOOLEAN DEFAULT FALSE,
    "isVerified" BOOLEAN DEFAULT FALSE,
    "creatorAddress" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on creator address for faster lookups
CREATE INDEX IF NOT EXISTS idx_collections_creator ON collections("creatorAddress");

-- Create index on verification status
CREATE INDEX IF NOT EXISTS idx_collections_verified ON collections("isVerified");
