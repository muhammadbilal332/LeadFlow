# Google Sheets secondary backup logging & business-data export

This is a **secondary, human-readable companion** to the real backup
system in [docs/DATABASE_BACKUP_AND_RESTORE.md](./DATABASE_BACKUP_AND_RESTORE.md).
It does two things, both additive to the existing R2 backup — neither
replaces it, neither can weaken it:

1. **Backup Log** — one row per R2 backup attempt (success or failure),
   so you can see backup history at a glance without downloading
   anything from R2.
2. **Export Runs** + three business-data tabs (**Leads**, **Outreach
   Contacts**, **Quotations**) — a readable, minimized, current snapshot
   of a small allowlist of business data, refreshed daily, for quick
   inspection.

## Why this is not a replacement for the PostgreSQL backups

- The Sheets export only ever contains a **small, deliberately minimized
  allowlist** of columns from 3 of this app's 39 tables (see below) — it
  cannot restore your database.
- It's a **current snapshot** for the 3 business tabs — each daily run
  overwrites the previous one. It is not a point-in-time archive the way
  every R2 `.dump` file is.
- If you ever need to actually recover data, the R2 backups
  (`docs/DATABASE_BACKUP_AND_RESTORE.md`) are the only authoritative,
  complete, restorable source. Google Sheets is for glancing at "is the
  backup system alive" and "what did this data look like recently" —
  nothing more.

## Exported tables and columns (the full allowlist, and why)

The allowlist lives in one file —
[`scripts/backup/sheets/src/businessDataConfig.ts`](../scripts/backup/sheets/src/businessDataConfig.ts)
— and nowhere else decides what leaves the database for Sheets.

| Tab | Table | Columns | Excluded from this table, and why |
|---|---|---|---|
| **Leads** | `leads` | id, business_id, assigned_user_id, name, company, email, phone, source, industry, status, score, priority, sla_status, created_at, updated_at | `description` (unbounded free text, could hold arbitrary customer detail); UTM/ad-attribution columns (marketing minutiae, not needed for historical business inspection); `linkedin_url`, `duplicate_of_lead_id`, `merged_at`, `normalized_email`/`normalized_phone` (internal mechanics, no added business value) |
| **Outreach Contacts** | `outreach_contacts` | id, business_id, lead_id, contact_name, company_name, email, industry, location, source, status, created_at, updated_at | `pain_points`, `possible_solution`, `notes` (unbounded free text — exactly the "sensitive content" the task asked to exclude); `custom_context` (arbitrary JSON); `sheet_import_id`, `brand_name`, `website` (low business value, more columns than needed) |
| **Quotations** | `quotations` | id, business_id, lead_id, created_by, title, amount, status, created_at, updated_at | `notes` (free text) |

### Tables deliberately excluded entirely, and why

- **`users`** — authentication/permissions, not business data (also
  holds `password_hash`, never to be exported under any circumstance).
- **`api_keys`, `webhooks`, `integrations`** — hold `key_hash`,
  `secret_hash`, `access_token_encrypted`. Credentials, never exported.
- **`outreach_messages`, `outreach_drafts`, `email_replies`,
  `email_threads`** — actual email/outreach content. The task
  explicitly asked to exclude "sensitive email content or generated
  outreach content unless explicitly approved" — not approved here.
- **`notes`, `activities`, `ai_qualifications`, `ai_generation_logs`** —
  unbounded free text or AI-generated inferences about leads; excluded
  for the same reason as the free-text columns above.
- Everything else (routing rules, SLA settings, notifications, sheet
  connections/imports, suppressions, email settings, provider usage,
  audit logs, system events, `automation_execution_logs`) is
  operational/configuration data, not business records, per the task's
  own framing of what belongs in this export.

**There is no "Companies" or "Contacts" table in the actual schema** —
`company` is a plain text field on `leads`, and `outreach_contacts`
(cold-outreach prospects — a different concept from CRM leads) is the
closest existing equivalent to "Contacts". Nothing was invented to match
an example tab name that didn't correspond to real structure.

## Spreadsheet structure

One dedicated, private Google Sheet, shared only with the service
account (never with "anyone with the link"):

| Tab | Write pattern | Contains |
|---|---|---|
| **Backup Log** | Append-only, one row per R2 backup attempt | timestamp, run id/attempt, status, object key, size, checksum, duration, error summary |
| **Export Runs** | Append-only, one row per business-data export attempt | timestamp, run id/attempt, trigger, status, which tables + row counts, duration, error summary |
| **Leads**, **Outreach Contacts**, **Quotations** | Overwritten each successful export (current snapshot) | the allowlisted columns above |

Append-only tabs are never cleared or overwritten by this system —
`scripts/backup/sheets/src/logBackupManifest.ts` only ever calls the
Sheets API's `append` operation for them, and a row is skipped entirely
(not duplicated) if the same GitHub Actions run+attempt was already
logged.

## Snapshot consistency

All three business-data tables are read inside **one PostgreSQL
`REPEATABLE READ READ ONLY` transaction**, so they reflect one consistent
point in time relative to each other — not three separate queries that
could interleave with concurrent application writes. The transaction's
`READ ONLY` mode means Postgres itself rejects any write attempt; this
isn't just application discipline, it's enforced by the database.

## Schedule

- **Backup Log**: every 15 minutes, piggybacking on the existing R2
  backup schedule (`database-backup.yml`) — no new schedule, no change
  to R2's own 15-minute cadence.
- **Export Runs + business-data tabs**: **daily** at 03:00 UTC
  (`business-data-export.yml`), plus manual `workflow_dispatch`.

  Why daily, not every 15 minutes: business data (leads, contacts,
  quotations) changes far slower than every 15 minutes, and a full
  overwrite of 3 tabs that often would multiply Sheets API calls roughly
  96x for no real benefit — nobody needs a quarter-hourly refresh of a
  spreadsheet meant for occasional human inspection. If your data volume
  or review needs genuinely justify a shorter interval later, this is a
  one-line cron change in `business-data-export.yml` — but do that
  deliberately, not as a default.

## Spreadsheet limits

This toolkit enforces its own conservative ceiling — **20,000 rows per
tab** — well under Google's real hard limits (10,000,000 cells per
spreadsheet, 18,278 columns per sheet). If a table ever exceeds that, the
export **skips that table and reports why** in Export Runs, rather than
writing a silently-truncated, misleading snapshot. The documented
alternative in that situation is the full R2 backup, which has no such
limit.

## Authentication

**Method chosen: a dedicated Google Cloud service account with a JSON
key**, not GitHub OIDC/workload identity federation.

Why: OIDC/workload identity federation needs IAM configuration inside a
Google Cloud project (creating a workload identity pool, a provider
trusting GitHub's OIDC issuer, and binding it to the service account) —
real security value for infrastructure accessing broad resources, but
disproportionate setup for a single-purpose credential that can only ever
touch one spreadsheet it's explicitly shared with. The service account's
own access is already least-privilege (scope is always exactly
`https://www.googleapis.com/auth/spreadsheets`, and it's shared with
nothing else in your Drive) — if you later want to move to OIDC, the only
thing that changes is how the access token is obtained
(`scripts/backup/sheets/src/googleAuth.ts`); nothing else in this system
depends on the auth method.

The toolkit itself has **no Google SDK dependency** — it's a hand-rolled
JWT signer (Node's built-in `crypto`) plus `fetch`, specifically to keep
the dependency surface small for a script that handles a private key.

## Manual setup (you must do this — nothing here is live until you do)

### 1. Create a Google Cloud project (or reuse one you control)

[console.cloud.google.com](https://console.cloud.google.com) → New
Project → name it something like `leadflow-backup-logging`.

### 2. Enable the Google Sheets API

In that project: **APIs & Services → Library → Google Sheets API →
Enable**.

### 3. Create a dedicated service account

**IAM & Admin → Service Accounts → Create Service Account.** Name it
e.g. `leadflow-backup-logger`. You do **not** need to grant it any
project-level IAM role — it only needs access to the one spreadsheet you
share with it directly (step 5).

### 4. Create a JSON key for it

On the service account: **Keys → Add Key → Create new key → JSON**.
This downloads a `.json` file — **never commit it anywhere**. You'll
paste its contents (as one line) into a GitHub secret in step 6.

### 5. Create the spreadsheet and share it with the service account

Create one new Google Sheet (any name — e.g. "LeadFlow Backup
Reporting"). Click **Share**, paste the service account's email (looks
like `leadflow-backup-logger@your-project.iam.gserviceaccount.com`,
visible on the service account's page), give it **Editor** access.
**Do not** share it with anyone else unless they specifically need to see
this data — treat it as confidential, per the privacy section below.
Leave it empty — the tabs and headers are created automatically on first
run.

Copy the spreadsheet's ID from its URL:
`https://docs.google.com/spreadsheets/d/`**`THIS_PART_IS_THE_ID`**`/edit`.

### 6. Add the two GitHub repository secrets

**Settings → Secrets and variables → Actions → New repository secret:**

- `GOOGLE_SERVICE_ACCOUNT_JSON` — paste the entire downloaded JSON file's
  contents as-is (it's fine that it's multi-line; GitHub secrets accept
  that).
- `GOOGLE_SHEETS_SPREADSHEET_ID` — the ID from step 5.

### 7. Trigger a manual run to verify

**Actions tab → "Database backup" → Run workflow** (verifies the Backup
Log path), and separately **Actions tab → "Business data export" → Run
workflow** (verifies the business-data tabs). Check the spreadsheet
afterward.

## Reading the manifest / identifying problems

- **A gap in Backup Log's timestamps** longer than ~15–20 minutes during
  a period you'd expect activity means either the schedule didn't fire
  (see the cron caveat in `DATABASE_BACKUP_AND_RESTORE.md`) or this
  logging step itself failed (check the Actions tab — the R2 backup
  result is authoritative regardless, this log is secondary).
- **A `status=failure` row** with a populated `error_summary` tells you
  exactly which step failed, without needing to open the Actions log.
- **Export Runs with `(skipped: see logs)`** next to a table name means
  that table exceeded the row-safety limit for that run — check that
  run's GitHub Actions log for the specific reason, and use the R2
  backup for that table's complete data.

## Privacy and access control

- The spreadsheet is private by default (shared only with the service
  account) — keep it that way. Anyone you add as a viewer/editor can see
  every exported lead, contact, and quotation.
- The data in it, while minimized, is still real business data about
  real people and real deals — treat the spreadsheet with the same care
  as any other system holding customer information.
- The service account's key (`GOOGLE_SERVICE_ACCOUNT_JSON`) is a
  credential — if it's ever exposed, revoke it immediately (IAM & Admin
  → Service Accounts → that account → Keys → delete the key) and issue a
  new one.

## Cost and quota

See the implementation report for the full numbers; in short: Google
Sheets API usage here is far under its free quota (both the per-minute
request-rate limit and the lack of any per-request charge for this API),
and the spreadsheet's own storage is a negligible fraction of a Google
account's free 15 GB Drive/Gmail/Photos allowance. No billing-enabled
Google Cloud service is required for any of this.
