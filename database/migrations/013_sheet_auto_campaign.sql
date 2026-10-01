-- Lets a sheet connection remember the campaign that auto-pilot sheet
-- imports feed into, so repeated imports from the same sheet keep landing
-- in one ongoing campaign instead of spawning a new one every run.
-- Purely additive.

ALTER TABLE sheet_connections
  ADD COLUMN IF NOT EXISTS default_campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE SET NULL;
