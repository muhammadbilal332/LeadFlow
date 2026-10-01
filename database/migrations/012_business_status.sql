-- Adds a deactivation flag to businesses, for the developer dashboard's
-- business management actions. Purely additive.

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
