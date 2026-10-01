CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(30) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payment_intent_id VARCHAR(255),
  transaction_id INTEGER,
  status VARCHAR(20) NOT NULL,
  payload JSONB,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_event_id
  ON payment_webhook_events (provider_event_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_transaction_id
  ON payment_webhook_events (transaction_id);
