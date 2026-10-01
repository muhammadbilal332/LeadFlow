-- Automatic lead assignment: simple prioritized rules plus a round-robin
-- fallback and a per-business response-time (SLA) target per priority tier.

CREATE TABLE IF NOT EXISTS lead_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  field TEXT NOT NULL CHECK (field IN ('source', 'industry', 'score', 'always')),
  operator TEXT NOT NULL CHECK (operator IN ('equals', 'gte', 'lte')),
  value TEXT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('user', 'round_robin', 'owner')),
  assign_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_business_id ON lead_routing_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_business_priority ON lead_routing_rules(business_id, priority);

-- One cursor per business, so round-robin assignment rotates through active
-- sales users in a stable order.
CREATE TABLE IF NOT EXISTS round_robin_cursors (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  last_assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-business, per-priority response targets. Used both to compute a
-- lead's sla_due_at and to size its automatically-created follow-up.
CREATE TABLE IF NOT EXISTS sla_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  hot_minutes INTEGER NOT NULL DEFAULT 15,
  high_minutes INTEGER NOT NULL DEFAULT 30,
  medium_minutes INTEGER NOT NULL DEFAULT 120,
  low_minutes INTEGER NOT NULL DEFAULT 1440,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
