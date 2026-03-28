CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_address VARCHAR(56) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    banner_image_url VARCHAR(500),
    creator_id UUID NOT NULL REFERENCES users(id),
    total_supply INTEGER DEFAULT 0,
    floor_price DECIMAL(20,7),
    total_volume DECIMAL(20,7) DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_creator_id
    ON collections(creator_id);

CREATE INDEX IF NOT EXISTS idx_collections_contract_address
    ON collections(contract_address);

CREATE INDEX IF NOT EXISTS idx_collections_total_volume
    ON collections(total_volume DESC);
