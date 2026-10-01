-- Outreach / email automation platform: Google Sheet (or CSV) import of
-- contacts, AI-personalized sequences with mandatory human approval,
-- provider-agnostic sending, reply detection/classification, and permanent
-- suppression. Every table is tenant-scoped via business_id, derived
-- server-side from the authenticated session — never trusted from the client.
--
-- This migration is purely additive: no existing table, column, or row is
-- modified or removed.

-- ===========================================================
-- sheet_connections / sheet_imports
-- ===========================================================
CREATE TABLE IF NOT EXISTS sheet_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock', 'google')),
  spreadsheet_id TEXT,
  sheet_range TEXT DEFAULT 'Sheet1',
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sheet_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES sheet_connections(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'sheet' CHECK (source_type IN ('sheet', 'csv', 'manual')),
  status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Running', 'Completed', 'Failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================
-- outreach_contacts
-- ===========================================================
CREATE TABLE IF NOT EXISTS outreach_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sheet_import_id UUID REFERENCES sheet_imports(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  company_name TEXT,
  brand_name TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  location TEXT,
  pain_points TEXT,
  possible_solution TEXT,
  notes TEXT,
  custom_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suppressed', 'unsubscribed', 'bounced', 'do_not_contact')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, normalized_email)
);

CREATE INDEX IF NOT EXISTS idx_outreach_contacts_business_id ON outreach_contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_status ON outreach_contacts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_lead_id ON outreach_contacts(lead_id);

-- ===========================================================
-- outreach_sequences / outreach_sequence_steps
-- ===========================================================
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject_template TEXT NOT NULL,
  body_template TEXT,
  ai_personalize BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_id ON outreach_sequence_steps(sequence_id, step_order);

-- ===========================================================
-- outreach_campaigns / outreach_campaign_contacts
-- ===========================================================
CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved', 'running', 'paused', 'completed', 'cancelled')),
  sender_name TEXT,
  sender_email TEXT,
  reply_to TEXT,
  sequence_id UUID REFERENCES outreach_sequences(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_business_id ON outreach_campaigns(business_id);

CREATE TABLE IF NOT EXISTS outreach_campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'drafted', 'approved', 'queued', 'sent', 'delivered', 'bounced', 'replied', 'unsubscribed', 'stopped', 'failed')),
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  stopped_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON outreach_campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_next_send ON outreach_campaign_contacts(business_id, next_send_at) WHERE next_send_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact_id ON outreach_campaign_contacts(contact_id);

-- ===========================================================
-- outreach_drafts
-- ===========================================================
CREATE TABLE IF NOT EXISTS outreach_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_contact_id UUID NOT NULL REFERENCES outreach_campaign_contacts(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  subject TEXT NOT NULL,
  ai_raw_body TEXT NOT NULL,
  naturalized_body TEXT NOT NULL,
  final_body TEXT,
  quality_status TEXT NOT NULL DEFAULT 'passed' CHECK (quality_status IN ('passed', 'warnings', 'blocked')),
  quality_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'sent')),
  scheduled_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_drafts_business_id ON outreach_drafts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_campaign_contact ON outreach_drafts(campaign_contact_id);

-- ===========================================================
-- outreach_messages / outreach_events
-- ===========================================================
CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_contact_id UUID NOT NULL REFERENCES outreach_campaign_contacts(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES outreach_drafts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  thread_id UUID,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_business_id ON outreach_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_campaign_contact ON outreach_messages(campaign_contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_provider_message_id ON outreach_messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_status ON outreach_messages(business_id, status);

CREATE TABLE IF NOT EXISTS outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  message_id UUID REFERENCES outreach_messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('queued', 'sent', 'delivered', 'opened', 'bounced', 'failed', 'reply', 'complaint')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_business_id ON outreach_events(business_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_message_id ON outreach_events(message_id);

-- ===========================================================
-- email_threads / email_replies
-- ===========================================================
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  provider_thread_id TEXT,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_business_id ON email_threads(business_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_contact_id ON email_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_provider_thread_id ON email_threads(provider_thread_id);

ALTER TABLE outreach_messages ADD CONSTRAINT fk_outreach_messages_thread
  FOREIGN KEY (thread_id) REFERENCES email_threads(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  message_id UUID REFERENCES outreach_messages(id) ON DELETE SET NULL,
  from_email TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'unknown'
    CHECK (classification IN ('interested', 'meeting_request', 'question', 'not_interested', 'unsubscribe', 'wrong_person', 'referral', 'out_of_office', 'unknown')),
  provider_reply_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider_reply_id)
);

CREATE INDEX IF NOT EXISTS idx_email_replies_business_id ON email_replies(business_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_thread_id ON email_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_contact_id ON email_replies(contact_id);

-- ===========================================================
-- suppressions
-- ===========================================================
CREATE TABLE IF NOT EXISTS suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  normalized_email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'manual', 'complaint', 'wrong_contact')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, normalized_email)
);

CREATE INDEX IF NOT EXISTS idx_suppressions_business_id ON suppressions(business_id);

-- ===========================================================
-- email_settings / provider_usage
-- ===========================================================
CREATE TABLE IF NOT EXISTS email_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  default_sender_name TEXT,
  default_sender_email TEXT,
  default_reply_to TEXT,
  daily_send_limit INTEGER NOT NULL DEFAULT 100,
  voice_description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'monthly')),
  period_key TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider, period, period_key)
);

CREATE INDEX IF NOT EXISTS idx_provider_usage_business_id ON provider_usage(business_id);

-- ===========================================================
-- ai_generation_logs / outreach_audit_logs
-- ===========================================================
CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_contact_id UUID REFERENCES outreach_campaign_contacts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  prompt_summary TEXT NOT NULL,
  output_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_business_id ON ai_generation_logs(business_id);

CREATE TABLE IF NOT EXISTS outreach_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_audit_logs_business_id ON outreach_audit_logs(business_id, created_at);
