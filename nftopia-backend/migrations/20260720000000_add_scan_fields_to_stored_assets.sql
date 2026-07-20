ALTER TABLE stored_assets
  ADD COLUMN IF NOT EXISTS scan_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scan_result JSONB,
  ADD COLUMN IF NOT EXISTS quarantined BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stored_assets_scan_status
  ON stored_assets (scan_status);

CREATE INDEX IF NOT EXISTS idx_stored_assets_quarantined
  ON stored_assets (quarantined)
  WHERE quarantined = TRUE;
