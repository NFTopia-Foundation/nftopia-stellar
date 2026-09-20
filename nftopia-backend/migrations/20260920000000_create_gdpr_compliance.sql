-- GDPR compliance: data export jobs, account deletion requests, audit trail

-- Anonymization markers on the user row. The row itself is preserved so that
-- on-chain / marketplace records referencing the user id stay resolvable.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS data_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format VARCHAR(10) NOT NULL DEFAULT 'json',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  data TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_export_jobs_user_id ON data_export_jobs (user_id);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION',
  reason TEXT,
  verification_token_hash VARCHAR(64),
  verification_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_id ON account_deletion_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON account_deletion_requests (status);

-- Append-only trail. Intentionally has no FK to users so records survive
-- erasure for compliance auditing.
CREATE TABLE IF NOT EXISTS gdpr_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(64),
  metadata JSONB,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gdpr_audit_logs_user_id ON gdpr_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_audit_logs_action ON gdpr_audit_logs (action);

-- New transactional email type used by the deletion-verification flow.
ALTER TYPE email_logs_type_enum ADD VALUE IF NOT EXISTS 'account_deletion';
