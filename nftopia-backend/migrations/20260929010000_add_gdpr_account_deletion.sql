ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_last_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS account_deletion_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(64),
  success BOOLEAN NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_audits_user_created
  ON account_deletion_audits (user_id, created_at DESC);

ALTER TABLE auctions ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE auctions ALTER COLUMN winner_id DROP NOT NULL;
ALTER TABLE bids ALTER COLUMN bidder_id DROP NOT NULL;
ALTER TABLE listings ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE offers ALTER COLUMN bidder_id DROP NOT NULL;
ALTER TABLE offers ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE nfts ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE nfts ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS creator_id UUID;
ALTER TABLE collections ALTER COLUMN creator_id DROP NOT NULL;

ALTER TYPE email_logs_type_enum
  ADD VALUE IF NOT EXISTS 'account_deletion_verification';