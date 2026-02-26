CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stored_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash VARCHAR(64) NOT NULL,
  ipfs_cid VARCHAR(255),
  arweave_id VARCHAR(255),
  primary_storage VARCHAR(16) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  original_filename TEXT NOT NULL,
  uploaded_by VARCHAR(255) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stored_assets_file_hash
  ON stored_assets (file_hash);

CREATE INDEX IF NOT EXISTS idx_stored_assets_primary_storage
  ON stored_assets (primary_storage);

CREATE INDEX IF NOT EXISTS idx_stored_assets_uploaded_by
  ON stored_assets (uploaded_by);
