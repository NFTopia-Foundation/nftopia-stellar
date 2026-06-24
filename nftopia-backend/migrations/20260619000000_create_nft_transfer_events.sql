-- Migration: Create nft_transfer_events table for ownership history/provenance
-- This table tracks all NFT transfers including mint, sale, and wallet-to-wallet transfers

CREATE TABLE IF NOT EXISTS nft_transfer_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- NFT identification
  nft_contract_id   VARCHAR(56) NOT NULL,
  token_id          VARCHAR(128) NOT NULL,
  
  -- Transfer details
  from_address      VARCHAR(56) NOT NULL,
  to_address        VARCHAR(56) NOT NULL,
  transaction_hash  VARCHAR(64) NOT NULL,
  
  -- Event classification
  event_type        VARCHAR(20) NOT NULL 
                    CHECK (event_type IN ('mint', 'sale', 'transfer')),
  
  -- Sale-specific fields (nullable for non-sale events)
  price             NUMERIC(20, 7) NULL,
  currency          VARCHAR(12) DEFAULT 'XLM',
  
  -- Blockchain metadata
  ledger_sequence   BIGINT NOT NULL,
  timestamp         BIGINT NOT NULL, -- Unix timestamp from ledger
  
  -- Additional metadata
  memo              TEXT NULL,
  metadata          JSONB NULL,
  
  -- Indexing timestamps
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_nft_transfer_events_nft 
  ON nft_transfer_events (nft_contract_id, token_id);

CREATE INDEX IF NOT EXISTS idx_nft_transfer_events_timestamp 
  ON nft_transfer_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_nft_transfer_events_event_type 
  ON nft_transfer_events (event_type);

CREATE INDEX IF NOT EXISTS idx_nft_transfer_events_from_address 
  ON nft_transfer_events (from_address);

CREATE INDEX IF NOT EXISTS idx_nft_transfer_events_to_address 
  ON nft_transfer_events (to_address);

CREATE INDEX IF NOT EXISTS idx_nft_transfer_events_transaction_hash 
  ON nft_transfer_events (transaction_hash);

-- Composite index for pagination queries
CREATE INDEX IF NOT EXISTS idx_nft_transfer_events_nft_timestamp 
  ON nft_transfer_events (nft_contract_id, token_id, timestamp DESC);

-- Unique constraint to prevent duplicate event processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_nft_transfer_events_unique 
  ON nft_transfer_events (transaction_hash, nft_contract_id, token_id);

-- Add comment for documentation
COMMENT ON TABLE nft_transfer_events IS 'Tracks all NFT ownership changes including mint, sale, and transfers for provenance';