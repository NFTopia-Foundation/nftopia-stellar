-- #751: optional per-user, per-tool-set AI chat rate-limit budgets, e.g.
-- {"marketplace-assistant": 60, "creator-copilot": 15}. NULL (or a tool set
-- missing from the object) means the env-configured default applies.
ALTER TABLE user_ai_cap_overrides
  ADD COLUMN IF NOT EXISTS rate_limit_points JSONB;
