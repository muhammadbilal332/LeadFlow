-- LeadFlow no longer depends on n8n specifically for outreach scheduling
-- (any HTTP-capable scheduler can call POST /api/outreach/tick, authenticated
-- with a LeadFlow API key — currently a GitHub Actions scheduled workflow).
-- This table's purpose was never actually n8n-specific — it just records
-- every call to the tick endpoint, success or failure, regardless of who
-- made it — so it's renamed to reflect that, with all existing history
-- preserved (a plain rename, not a drop/recreate).

ALTER TABLE n8n_execution_logs RENAME TO automation_execution_logs;

-- Index names are internal/cosmetic only (nothing in application code
-- references them), so they're deliberately left as-is rather than
-- renamed — a plain table rename is the smallest safe change here.
