CREATE TYPE listing_status AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_id VARCHAR(255) NOT NULL,
  seller_id VARCHAR(255) NOT NULL,
  price NUMERIC(20,7) NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'XLM',
  status listing_status NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_nft_id ON listings (nft_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings (seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings (created_at);
