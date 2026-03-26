CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS nfts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id VARCHAR(100) NOT NULL UNIQUE,
    contract_address VARCHAR(56) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    animation_url VARCHAR(500),
    external_url VARCHAR(500),
    owner_id UUID NOT NULL REFERENCES users(id),
    creator_id UUID NOT NULL REFERENCES users(id),
    collection_id UUID,
    minted_at TIMESTAMP DEFAULT NOW(),
    last_price DECIMAL(20,7),
    is_burned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
    IF to_regclass('public.collections') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_nfts_collection_id'
        ) THEN
            ALTER TABLE nfts
                ADD CONSTRAINT fk_nfts_collection_id
                FOREIGN KEY (collection_id) REFERENCES collections(id);
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS nft_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nft_id UUID NOT NULL REFERENCES nfts(id) ON DELETE CASCADE,
    trait_type VARCHAR(100) NOT NULL,
    value VARCHAR(255) NOT NULL,
    display_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfts_owner_id ON nfts(owner_id);
CREATE INDEX IF NOT EXISTS idx_nfts_creator_id ON nfts(creator_id);
CREATE INDEX IF NOT EXISTS idx_nfts_collection_id ON nfts(collection_id);
CREATE INDEX IF NOT EXISTS idx_nfts_token_id ON nfts(token_id);
CREATE INDEX IF NOT EXISTS idx_nft_attributes_nft_id ON nft_attributes(nft_id);
