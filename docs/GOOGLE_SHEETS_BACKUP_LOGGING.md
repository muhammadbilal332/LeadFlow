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

Both Sheets destinations run every 15 minutes, but only **during a
configurable working window** — a number of hours per day, on a
configurable set of weekdays, in a configurable timezone. Outside that
window, the scheduled run is a normal no-op (not a failure, not a skipped
trigger — the workflow still runs on schedule, it just decides there's
nothing to do).

**The R2 backup's own schedule is never affected by this window** — it
continues to run every 15 minutes, 24/7, exactly as before. Only the
secondary Sheets log and the business-data export are restricted to
working hours, to keep Sheets API usage and spreadsheet history growth
proportional to a real working day instead of running around the clock
for a feature meant for human inspection.

### Configuration (repository Variables, not Secrets — nothing sensitive)

Set these under **Settings → Secrets and variables → Actions → Variables**
(not the Secrets tab — these aren't sensitive, so they don't need encryption,
and showing up as plain variables makes the schedule easy to audit/change).
All are optional; every one has a documented default and none are hardcoded
into the workflow files themselves.

| Variable | Default | Meaning |
|---|---|---|
| `SHEETS_SCHEDULE_TIMEZONE` | `UTC` | Any IANA timezone name (e.g. `America/New_York`, `Asia/Karachi`). Daylight-saving transitions are handled automatically via Node's built-in timezone database — no manual DST adjustment needed. |
| `SHEETS_SCHEDULE_WORKING_DAYS` | `1,2,3,4,5,6` | Comma-separated ISO weekday numbers, `1`=Monday .. `7`=Sunday. Default is Monday-Saturday (6 days/week). |
| `SHEETS_SCHEDULE_START_HOUR` | `9` | Local hour (0-23) the working window opens, in the configured timezone. |
| `SHEETS_SCHEDULE_WORKING_HOURS` | `9` | How many hours the window stays open (1-24). Default window is 09:00-18:00. |

The window must stay within one calendar day (`start hour + working hours`
≤ 24) — a window that would cross midnight is rejected as a configuration
error (a clear failure in the "Check Sheets working-window schedule" step,
not a silent miscalculation) rather than guessed at. Pick a start hour and
duration that fit inside one day in the configured timezone.

The decision logic lives in one place —
[`scripts/backup/sheets/src/scheduleGate.ts`](../scripts/backup/sheets/src/scheduleGate.ts)
— covered by its own test suite (`scheduleGate.test.ts`), including a test
that verifies a DST transition is handled correctly without any
special-case code.

### Manual runs always bypass the window

`workflow_dispatch` (the **Run workflow** button in the Actions tab) always
performs the Sheets write, regardless of the configured window — useful for
testing or an emergency export. This bypasses only the *schedule* check; the
underlying safety checks (required secrets present, idempotent
run/attempt deduplication) in `logBackupManifest.ts` / `exportBusinessData.ts`
still apply exactly as on a scheduled run.

### Why every 15 minutes rather than daily

Both Sheets destinations now share the R2 backup's own 15-minute cron
trigger interval, so no second cron schedule needed to be invented — the
workflow simply checks the working-window gate on every firing and skips
the actual write when outside it. Business data (leads, contacts,
quotations) still won't change meaningfully every 15 minutes in practice,
but the gate means Sheets is refreshed promptly within working hours
without a human needing to wait for a fixed daily time, and the window
bounds total API usage to a known number of working hours per week (see
Cost and quota below) rather than 24/7.

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

### 7. (Optional) Configure the working-window schedule

Defaults to 09:00-18:00 UTC, Monday-Saturday — fine to skip this step and
keep those defaults. To change them: **Settings → Secrets and variables →
Actions → Variables tab → New repository variable** (these are Variables,
not Secrets — nothing here is sensitive):

- `SHEETS_SCHEDULE_TIMEZONE` — e.g. `Asia/Karachi`, `America/New_York`.
- `SHEETS_SCHEDULE_WORKING_DAYS` — e.g. `1,2,3,4,5` for Monday-Friday.
- `SHEETS_SCHEDULE_START_HOUR` — e.g. `8` for an 08:00 start.
- `SHEETS_SCHEDULE_WORKING_HOURS` — e.g. `8` for an 8-hour day.

See the Schedule section above for the full rules (window must fit in one
calendar day, weekday numbering, etc).

### 8. Trigger a manual run to verify

**Actions tab → "Database backup" → Run workflow** (verifies the Backup
Log path), and separately **Actions tab → "Business data export" → Run
workflow** (verifies the business-data tabs). Check the spreadsheet
afterward.

## Reading the manifest / identifying problems

- **A gap in Backup Log's timestamps that spans only outside your
  configured working window is expected** — no row is written there by
  design. A gap longer than ~15–20 minutes **during** the configured
  window means either the schedule didn't fire (see the cron caveat in
  `DATABASE_BACKUP_AND_RESTORE.md`) or this logging step itself failed
  (check the Actions tab — the R2 backup result is authoritative
  regardless, this log is secondary).
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

Google Sheets API v4 is free with no billing-enabled Google Cloud project
required, under published quotas (verified at
[developers.google.com/sheets/api/limits](https://developers.google.com/sheets/api/limits)):
**300 read requests and 300 write requests per minute, per project** (not
per spreadsheet) — far above what this system generates even at its
busiest.

With the default window (9 hours/day, 6 days/week = 54 working hours/week,
≈ 216 fifteen-minute slots/week) and both workflows firing every 15
minutes inside it:

- **Backup Log**: 1 Sheets API call (an append) per in-window run ≈ 216
  calls/week. Outside the window, the R2 backup still runs but the Sheets
  step is a no-op (zero calls).
- **Business data export**: roughly 15-20 calls per run (one metadata
  fetch, then per table: a capacity check, a read of the existing range, a
  header write, and one-or-few batched data writes, plus the Export Runs
  append) ≈ 3,200-4,300 calls/week at the busiest. Each run completes in a
  few seconds, so even its peak burst rate is a small fraction of the
  300-calls/minute quota, and runs never overlap (the `concurrency` group
  serializes them).

A narrower window (fewer hours/days) or a wider one (up to 24×7, by
setting `SHEETS_SCHEDULE_WORKING_HOURS=24` and all 7 days) scales these
numbers linearly — even 24×7 stays within quota for a database this size,
but the default keeps usage proportional to an actual working week rather
than running needlessly overnight and on days off.

GitHub Actions minutes are free and unlimited on this public repository
(see `docs/DATABASE_BACKUP_AND_RESTORE.md`), so the extra `workflow_dispatch`-
style 15-minute firings cost nothing there either — the gate step itself
is a few hundred milliseconds of Node with no external calls.

The spreadsheet's own storage is a negligible fraction of a Google
account's free 15 GB Drive/Gmail/Photos allowance — a few thousand text
rows is well under a megabyte.
