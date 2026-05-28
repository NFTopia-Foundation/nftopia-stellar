-- Migration: create offers table for the "Make Offer" system
-- Allows users to make binding XLM offers on any NFT,
-- whether listed for sale or not.

CREATE TABLE IF NOT EXISTS offers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NFT being offered on (composite reference to stellar_nfts)
  nft_contract_id  VARCHAR(56)  NOT NULL,
  nft_token_id     VARCHAR(128) NOT NULL,

  -- User who made the offer (FK to users)
  bidder_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- NFT owner at the time the offer was created (FK to users)
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Offer terms
  amount        NUMERIC(20, 7) NOT NULL CHECK (amount > 0),
  currency      VARCHAR(12)  NOT NULL DEFAULT 'XLM',
  expires_at    TIMESTAMPTZ  NOT NULL,

  -- Lifecycle status
  status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')),

  -- On-chain transaction XDR / hash produced on acceptance
  tx_hash       VARCHAR(128),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes to support common query patterns
CREATE INDEX IF NOT EXISTS idx_offers_nft
  ON offers (nft_contract_id, nft_token_id, status);

CREATE INDEX IF NOT EXISTS idx_offers_bidder
  ON offers (bidder_id, status);

CREATE INDEX IF NOT EXISTS idx_offers_owner
  ON offers (owner_id, status);

CREATE INDEX IF NOT EXISTS idx_offers_expires
  ON offers (expires_at)
  WHERE status = 'PENDING';
