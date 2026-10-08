-- CRM upgrade: adds the 'manager' role tier, a 'Replied' lead status for
-- automatic reply-detection transitions, and a real (nullable) LinkedIn
-- field on leads. Purely additive — no existing table, column, or row is
-- modified or removed.

-- ===========================================================
-- Add 'manager' as a valid user role (Employee=sales, Manager=manager,
-- Admin/Owner=owner).
-- ===========================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'sales', 'developer', 'manager'));

-- ===========================================================
-- Add 'Replied' as a valid lead status, set automatically when a genuine
-- inbound reply is detected for a lead's linked outreach contact.
-- ===========================================================
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('New','Contacted','Replied','Qualified','Proposal','Negotiation','Won','Lost'));

-- ===========================================================
-- Real (empty-by-default) LinkedIn field for the Lead Details page's
-- LinkedIn tab — no fabricated data, just a place to store it once known.
-- ===========================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
