-- Lightweight, database-backed automation rules layered on top of lead
-- intake: "WHEN lead created, IF conditions match, THEN run actions"
-- (e.g. notify the owner, or schedule an extra follow-up on hot leads).
-- Deliberately not a general-purpose workflow engine.

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL DEFAULT 'lead_created' CHECK (trigger_event IN ('lead_created')),
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_business_id ON automation_rules(business_id);
