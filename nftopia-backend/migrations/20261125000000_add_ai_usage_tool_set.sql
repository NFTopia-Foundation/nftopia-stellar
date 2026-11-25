ALTER TABLE ai_usage_records
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE ai_usage_records
  ADD COLUMN tool_set varchar(50) NOT NULL DEFAULT 'chat';

CREATE INDEX idx_ai_usage_records_tool_set_created_at
  ON ai_usage_records (tool_set, created_at);

ALTER TYPE email_logs_type_enum ADD VALUE IF NOT EXISTS 'ai_platform_spend_alert';
