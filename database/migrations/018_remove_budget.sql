-- Budget is no longer collected or shown anywhere in the app (scoring,
-- pipeline value, reports, lead forms). Drop the column itself.
ALTER TABLE leads DROP COLUMN IF EXISTS budget;
