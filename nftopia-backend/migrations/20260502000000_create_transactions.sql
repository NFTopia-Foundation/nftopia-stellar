-- Migration: create transactions table for contract-backed NFT purchases

CREATE TABLE IF NOT EXISTS transactions (
  id                SERIAL PRIMARY KEY,
  contract_tx_id    BIGINT NOT NULL UNIQUE,

  buyer_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  nft_id            UUID REFERENCES nfts(id) ON DELETE SET NULL,

  nft_contract_id   VARCHAR(56) NOT NULL,
  nft_token_id      VARCHAR(128) NOT NULL,

  amount            NUMERIC(20, 7) NOT NULL CHECK (amount >= 0),
  currency          VARCHAR(12) NOT NULL DEFAULT 'XLM',

  state             VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (state IN (
                       'draft',
                       'pending',
                       'executing',
                       'completed',
                       'cancelled',
                       'rolled_back',
                       'failed'
                     )),

  contract_state    VARCHAR(100),
  total_gas_used    BIGINT,
  total_cost        BIGINT,
  operation_results JSONB,
  error_reason      TEXT,

  created_at        BIGINT NOT NULL,
  executed_at       BIGINT,
  completed_at      BIGINT,

  metadata          JSONB,
  ipfs_metadata_uri TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id
  ON transactions (buyer_id);

CREATE INDEX IF NOT EXISTS idx_transactions_seller_id
  ON transactions (seller_id);

CREATE INDEX IF NOT EXISTS idx_transactions_nft_contract_token
  ON transactions (nft_contract_id, nft_token_id);

CREATE INDEX IF NOT EXISTS idx_transactions_state_created_at
  ON transactions (state, created_at DESC);
