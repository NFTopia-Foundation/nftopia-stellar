-- Migration: Enhance bids table for Soroban integration
-- Date: 2026-03-27
-- Issue: #70 – Soroban-Integrated BidModule

-- Add Soroban transaction hash (nullable, set after on-chain confirmation)
ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS tx_hash         VARCHAR(128),
  ADD COLUMN IF NOT EXISTS ledger_sequence INTEGER,
  ADD COLUMN IF NOT EXISTS stellar_public_key VARCHAR(56),
  ADD COLUMN IF NOT EXISTS amount_xlm      VARCHAR(30),
  ADD COLUMN IF NOT EXISTS soroban_status  VARCHAR(20) NOT NULL DEFAULT 'SKIPPED';

-- Performance indexes for bid queries
CREATE INDEX IF NOT EXISTS idx_bids_auction_ledger
  ON bids (auction_id, ledger_sequence DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_bids_auction_amount
  ON bids (auction_id, amount DESC);

CREATE INDEX IF NOT EXISTS idx_bids_bidder
  ON bids (bidder_id);

-- Partial index: quickly find confirmed on-chain bids
CREATE INDEX IF NOT EXISTS idx_bids_confirmed
  ON bids (auction_id, amount DESC)
  WHERE soroban_status = 'CONFIRMED';

-- Backfill amount_xlm for existing rows (amount stored in XLM already)
UPDATE bids
SET amount_xlm = CAST(amount AS VARCHAR)
WHERE amount_xlm IS NULL;
