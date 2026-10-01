-- Lightweight campaign aggregation. Campaigns are matched to leads by
-- utm_campaign at intake time (find-or-create), giving simple per-campaign
-- reporting without a full advertising-platform data model.

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT,
  utm_campaign TEXT,
  external_campaign_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_business_id ON campaigns(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_business_utm
  ON campaigns(business_id, utm_campaign) WHERE utm_campaign IS NOT NULL;
