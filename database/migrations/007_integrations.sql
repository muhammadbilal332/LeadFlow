-- External integrations: Meta (Facebook/Instagram) lead-ads webhook
-- connection status, and per-business generic inbound webhooks (used by
-- n8n or any other automation tool) with a delivery log.

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'n8n')),
  status TEXT NOT NULL DEFAULT 'Disconnected' CHECK (status IN ('Connected', 'Disconnected')),
  external_account_id TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  access_token_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_business_id ON integrations(business_id);

-- One inbound webhook per business. The secret is stored only as a hash;
-- the full value is shown to the owner once, at creation/rotation time.
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  secret_hash TEXT NOT NULL,
  secret_prefix TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Success', 'Failed')),
  payload JSONB,
  error TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_business_id ON webhook_deliveries(business_id);
