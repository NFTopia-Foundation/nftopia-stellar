CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nft_contract_id TEXT NOT NULL,
    nft_token_id TEXT NOT NULL,
    seller_id UUID NOT NULL REFERENCES users(id),
    price DECIMAL(20,7) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XLM',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_listings_nft_contract_id ON listings(nft_contract_id);
CREATE INDEX idx_listings_nft_token_id ON listings(nft_token_id);
CREATE INDEX idx_listings_seller_id ON listings(seller_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_price ON listings(price);
