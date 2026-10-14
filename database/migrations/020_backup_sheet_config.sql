-- A single, platform-level place for the developer console to record a
-- reference link to the Google Sheet used by the Cloudflare R2 secondary
-- backup/export system (see docs/GOOGLE_SHEETS_BACKUP_LOGGING.md). This is
-- a convenience bookmark only — it stores no credentials, no spreadsheet
-- data, and is never read by the GitHub Actions backup workflows
-- themselves (those are configured exclusively via GitHub repository
-- secrets, per that system's own design). Purely additive.

-- Singleton-row table: the boolean primary key with a CHECK constraint
-- that it must be true guarantees at most one row can ever exist.
CREATE TABLE IF NOT EXISTS backup_sheet_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  spreadsheet_url TEXT,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
