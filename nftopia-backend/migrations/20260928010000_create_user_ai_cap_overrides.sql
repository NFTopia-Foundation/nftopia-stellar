CREATE TABLE IF NOT EXISTS user_ai_cap_overrides (
  user_id UUID PRIMARY KEY,
  daily_token_cap INTEGER,
  monthly_token_cap INTEGER,
  daily_spend_cap_usd DECIMAL(12, 6),
  monthly_spend_cap_usd DECIMAL(12, 6),
  reason TEXT,
  granted_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
