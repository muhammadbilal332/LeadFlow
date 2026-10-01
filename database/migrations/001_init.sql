-- LeadFlow initial schema
-- Compatible with Supabase PostgreSQL (and plain PostgreSQL 13+)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================================
-- businesses
-- ===========================================================
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================
-- users
-- ===========================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'sales')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email)
);

-- ===========================================================
-- leads
-- ===========================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'Other'
    CHECK (source IN ('Website','WhatsApp','Facebook','Instagram','Phone','Referral','Other')),
  industry TEXT,
  interested_in TEXT,
  budget NUMERIC(12,2),
  timeline TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'New'
    CHECK (status IN ('New','Contacted','Qualified','Proposal','Negotiation','Won','Lost')),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================
-- follow_ups
-- ===========================================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'Call'
    CHECK (type IN ('Call','Email','Meeting','WhatsApp','Other')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================
-- activities
-- ===========================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================
-- notes
-- ===========================================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================
-- quotations
-- ===========================================================
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Sent','Accepted','Rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================
-- ai_qualifications
-- ===========================================================
CREATE TABLE IF NOT EXISTS ai_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  qualification TEXT NOT NULL CHECK (qualification IN ('Hot','Warm','Cold')),
  summary TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================
-- Indexes
-- ===========================================================
CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE INDEX IF NOT EXISTS idx_leads_business_id ON leads(business_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user_id ON leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_business_status ON leads(business_id, status);

CREATE INDEX IF NOT EXISTS idx_followups_business_id ON follow_ups(business_id);
CREATE INDEX IF NOT EXISTS idx_followups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_scheduled_at ON follow_ups(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_followups_user_id ON follow_ups(user_id);

CREATE INDEX IF NOT EXISTS idx_activities_business_id ON activities(business_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);

CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_notes_business_id ON notes(business_id);

CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_business_id ON quotations(business_id);

CREATE INDEX IF NOT EXISTS idx_ai_qual_lead_id ON ai_qualifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_qual_business_id ON ai_qualifications(business_id);

-- ===========================================================
-- updated_at trigger helper
-- ===========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON businesses;
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_quotations_updated_at ON quotations;
CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
