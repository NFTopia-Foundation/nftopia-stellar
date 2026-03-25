CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_contract_id VARCHAR(255) NOT NULL,
  token_id VARCHAR(255) NOT NULL,
  seller VARCHAR(255) NOT NULL,
  start_price NUMERIC(20,7) NOT NULL,
  reserve_price NUMERIC(20,7) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  min_bid_increment NUMERIC(20,7) NOT NULL DEFAULT 0.1000000,
  current_high_bid NUMERIC(20,7) NOT NULL,
  current_high_bidder VARCHAR(255),
  settled_at TIMESTAMPTZ,
  is_settled BOOLEAN NOT NULL DEFAULT FALSE,
  reserve_met BOOLEAN NOT NULL DEFAULT FALSE,
  winner_claimable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auctions_nft ON auctions (nft_contract_id, token_id);
CREATE INDEX IF NOT EXISTS idx_auctions_seller ON auctions (seller);
CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions (end_time);
