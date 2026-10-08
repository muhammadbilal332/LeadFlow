-- Removes the standalone "Ad Campaigns" marketing-attribution feature
-- (a lightweight campaigns table + leads.campaign_id, used only by the now
-- -removed /campaigns page and its reporting widget). This is purely about
-- that aggregation feature: the plain attribution TEXT fields on leads
-- (campaign, utm_campaign, utm_source, ad, ad_set, etc.) are untouched and
-- keep recording real attribution data from forms/webhooks/CSV as before.
--
-- The separate outreach_campaigns table (bulk cold-email campaigns backing
-- sheet-import auto-pilot, the Direct Lead Follow-ups system, and this
-- app's follow-up scheduling) is a completely different table and is not
-- touched by this migration.

-- CASCADE drops the FK constraint on leads.campaign_id along with the
-- table, without needing to know its exact auto-generated name.
DROP TABLE IF EXISTS campaigns CASCADE;
DROP INDEX IF EXISTS idx_leads_campaign_id;
ALTER TABLE leads DROP COLUMN IF EXISTS campaign_id;
