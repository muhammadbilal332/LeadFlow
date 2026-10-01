-- Widens the leads.source enum to include 'GoogleSheet', for leads created
-- automatically from an Outreach sheet import. Purely additive — every
-- existing value stays valid.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'Website','WhatsApp','Facebook','Instagram','Phone','Referral','Other',
    'GoogleAds','Manual','CSV','API','Form','GoogleSheet'
  ));
