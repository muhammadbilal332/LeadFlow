-- Marketing attribution, duplicate detection, and response-SLA tracking for leads.
-- Existing rows receive safe defaults; nothing here removes or narrows any
-- existing column, constraint, or value.

-- Widen the source enum to cover all intake channels described in the
-- capture/automation platform, while keeping every existing value intact.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'Website','WhatsApp','Facebook','Instagram','Phone','Referral','Other',
    'GoogleAds','Manual','CSV','API','Form'
  ));

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source_detail TEXT,
  ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES lead_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign TEXT,
  ADD COLUMN IF NOT EXISTS ad_set TEXT,
  ADD COLUMN IF NOT EXISTS ad TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS landing_page TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS normalized_email TEXT,
  ADD COLUMN IF NOT EXISTS normalized_phone TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_of_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium'
    CHECK (priority IN ('Low','Medium','High','Hot')),
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (sla_status IN ('Pending','Met','Missed'));

-- Backfill priority for pre-existing leads from their existing score, so the
-- new band is meaningful immediately rather than defaulting everyone to Medium.
UPDATE leads SET priority = CASE
  WHEN score >= 85 THEN 'Hot'
  WHEN score >= 70 THEN 'High'
  WHEN score >= 40 THEN 'Medium'
  ELSE 'Low'
END;

-- Idempotency for webhook-delivered leads (Meta/n8n may redeliver the same
-- event): a given external_source + external_id can only create one lead
-- per business.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_dedup
  ON leads(business_id, external_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_normalized_email ON leads(business_id, normalized_email);
CREATE INDEX IF NOT EXISTS idx_leads_normalized_phone ON leads(business_id, normalized_phone);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_form_id ON leads(form_id);
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads(business_id, utm_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_sla_status ON leads(business_id, sla_status);
CREATE INDEX IF NOT EXISTS idx_leads_duplicate_of ON leads(duplicate_of_lead_id);

-- ===========================================================
-- Richer, optional AI qualification fields (additive; existing
-- score/qualification/summary/reasoning/recommended_action are untouched).
-- ===========================================================
ALTER TABLE ai_qualifications
  ADD COLUMN IF NOT EXISTS strengths TEXT,
  ADD COLUMN IF NOT EXISTS concerns TEXT,
  ADD COLUMN IF NOT EXISTS urgency TEXT,
  ADD COLUMN IF NOT EXISTS suggested_response TEXT,
  ADD COLUMN IF NOT EXISTS estimated_priority TEXT;
