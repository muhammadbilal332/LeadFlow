-- Developer/Admin Dashboard: a platform-level role plus the tables needed
-- to show real audit trails, system events, and n8n execution history.
-- Purely additive — no existing table, column, or row is altered beyond
-- widening the `users.role` check constraint to add the new role value.

-- ===========================================================
-- Add 'developer' as a valid user role.
-- ===========================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'sales', 'developer'));

-- ===========================================================
-- developer_audit_logs — sensitive developer-level actions only
-- (role changes, account enable/disable, business inspection, provider
-- config views). Distinct from outreach_audit_logs, which is business-
-- scoped and covers outreach actions a business owner takes.
-- ===========================================================
CREATE TABLE IF NOT EXISTS developer_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  result TEXT NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failure')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_developer_audit_logs_created_at ON developer_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_audit_logs_actor ON developer_audit_logs(actor_user_id);

-- ===========================================================
-- system_events — structured application events for the developer Logs
-- page: auth failures, provider failures, uncaught API errors, and other
-- operationally-relevant events. Never stores passwords, keys, or JWTs.
-- ===========================================================
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  event_type TEXT NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity);

-- ===========================================================
-- n8n_execution_logs — every call to POST /api/outreach/tick is recorded
-- here. This is the honest, LeadFlow-side heartbeat the developer n8n
-- monitor is built on: n8n calls LeadFlow (not the other way around), so
-- "is n8n connected" is derived from real recent execution history here,
-- never assumed just because the endpoint exists.
-- ===========================================================
CREATE TABLE IF NOT EXISTS n8n_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('api_key', 'jwt')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  drafts_generated INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  blocked INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_n8n_execution_logs_created_at ON n8n_execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_execution_logs_triggered_by ON n8n_execution_logs(triggered_by);
