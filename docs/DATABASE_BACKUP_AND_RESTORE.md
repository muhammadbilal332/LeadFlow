# Database backup & restore

LeadFlow's Postgres database (Supabase) is backed up automatically, entirely
on GitHub-hosted infrastructure — **no laptop, local machine, or local
Docker install is part of production backup operation.** The schedule
(`.github/workflows/database-backup.yml`) runs on a GitHub-hosted
`ubuntu-latest` runner, which GitHub provisions fresh for every run and
destroys afterward.

## Architecture

```
GitHub Actions (ubuntu-latest, hosted by GitHub)
  -> installs PostgreSQL 17 client tools (apt, on the runner)
  -> pg_dump (schema `public` only, custom format, compressed)
  -> validate (pg_restore --list) + SHA-256 checksum
  -> upload dump + checksum to a private Cloudflare R2 bucket
  -> verify the uploaded object's size matches the local file
```

Nothing here executes on your laptop. The only local involvement, ever, is
you (a) adding GitHub repository secrets once, and (b) optionally
downloading a backup from R2 to inspect it, from whatever machine you
choose, at a time of your choosing.

**Secondary logging**: every backup attempt is also optionally mirrored
as one row in a Google Sheet, and a small, minimized allowlist of
business data is exported there daily for quick human inspection. This
is entirely additive — if it's not configured, or Google is down, the
R2 backup above is completely unaffected. See
[docs/GOOGLE_SHEETS_BACKUP_LOGGING.md](./GOOGLE_SHEETS_BACKUP_LOGGING.md).

### Why only schema `public`

A repository audit (see "Audit findings" below) confirmed LeadFlow uses its
own JWT authentication and never uses Supabase Auth or Supabase Storage.
Supabase provisions several platform-managed schemas on every project
(`auth`, `storage`, `realtime`, `vault`, `extensions`, `graphql`,
`graphql_public`, `pgbouncer`) — none of these contain LeadFlow application
data, and restoring them into a disposable (non-Supabase) Postgres instance
for a restore test would fail outright (e.g. the `vault` extension that
schema depends on only exists inside Supabase). The backup therefore scopes
`pg_dump --schema=public`, which is the complete set of LeadFlow's own 40
tables, functions, and triggers.

### Why a separate, direct database connection

The application itself connects through Supabase's pooler
(`aws-0-<region>.pooler.supabase.com`), shared with live request traffic.
Supabase's free-tier pooler caps **session-mode connections at 15 total,
shared by everything connecting to the database** — earlier in this
project, a local dev server left running against this same pooler was
enough to intermittently exhaust that budget and cause real request
failures. The backup workflow therefore uses a separate secret,
`SUPABASE_DB_URL`, pointed at Supabase's **direct** connection string (not
the pooler), so a backup run never competes with the live application for
pooler slots.

## Schedule limitation — read this before relying on "every 15 minutes"

GitHub Actions `schedule` (cron) triggers are **best-effort, not exact**:

- GitHub explicitly documents that scheduled workflows can be delayed,
  sometimes by a significant margin, during periods of high platform load.
  This project already observed a real multi-hour gap in another scheduled
  workflow (`outreach-tick.yml`) during this project's history.
- A repository with no activity (no commits, no runs) for 60+ days has its
  scheduled workflows **automatically disabled** until a human visits the
  Actions tab and re-enables them.

"Every 15 minutes" describes the *trigger interval configured*, not a
guaranteed recovery-point objective. Treat the actual gap between
consecutive successful backups (visible in R2's object listing, or in each
run's summary) as the real number, and check it periodically.

## Locating and downloading a backup from R2

Each backup is two objects: the dump and its checksum, both at
`leadflow/database/<YYYY>/<MM>/<DD>/leadflow-<UTC timestamp>.dump[.sha256]`.

Using the AWS CLI (R2 is S3-compatible):

```bash
export AWS_ACCESS_KEY_ID=<your R2 access key id>
export AWS_SECRET_ACCESS_KEY=<your R2 secret access key>
ENDPOINT="https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"

# List backups for a given day
aws s3 ls "s3://<R2_BUCKET_NAME>/leadflow/database/2026/10/11/" --endpoint-url "$ENDPOINT"

# Download one
aws s3 cp "s3://<R2_BUCKET_NAME>/leadflow/database/2026/10/11/leadflow-20261011T173245Z.dump" . --endpoint-url "$ENDPOINT"
aws s3 cp "s3://<R2_BUCKET_NAME>/leadflow/database/2026/10/11/leadflow-20261011T173245Z.dump.sha256" . --endpoint-url "$ENDPOINT"
```

Or use the Cloudflare dashboard (R2 -> your bucket -> browse/download) —
no AWS CLI needed, works from any browser.

## Verifying a backup

```bash
# Checksum
sha256sum -c leadflow-20261011T173245Z.dump.sha256

# Inspect the archive's contents without restoring anything
pg_restore --list leadflow-20261011T173245Z.dump | less
```

`pg_restore --list` reads the archive's table of contents only — it never
connects to any database, so this step is always safe to run against any
backup, anywhere.

## Restoring — to a disposable database only

**Never restore into the production LeadFlow database. A restore always
targets a disposable, throwaway Postgres instance** — a scratch Supabase
project, a free Neon/Railway/Fly Postgres, or a local Postgres you intend
to discard. The point of a restore is to prove the backup works and to
inspect/recover specific data, not to put a backup back into production.

### Option A — the restore-validation GitHub Actions workflow (recommended)

`.github/workflows/database-restore-validate.yml` is `workflow_dispatch`
only (manual trigger, Actions tab). It:

- Has **no access to the production database's connection string at all**
  — it only ever uses a separate secret, `RESTORE_TEST_DB_URL`, which you
  must point at a disposable Postgres instance.
- Refuses to run unless you type the exact phrase
  `yes-this-is-disposable` into the confirmation input.
- Downloads the backup you specify, verifies its checksum, validates its
  structure, restores it into `RESTORE_TEST_DB_URL`, then prints table/row
  counts for you to compare against the source.

This cannot *prove* `RESTORE_TEST_DB_URL` is truly disposable — only you
guarantee that by what you put in that secret. Never set it to the
production URL.

### Option B — locally, by hand

```bash
export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=...
export OBJECT_KEY="leadflow/database/2026/10/11/leadflow-20261011T173245Z.dump"
export RESTORE_TARGET_DB_URL="postgresql://...your-disposable-database..."
export I_CONFIRM_DISPOSABLE_TARGET="yes-this-is-disposable"
bash scripts/backup/restore-database.sh
```

Requires `pg_restore` and the `aws` CLI installed locally (not required for
production operation — only if you choose to restore from your own
machine rather than via the GitHub Actions workflow).

## Verifying a restore actually worked

After restoring, compare against the source (or against the dump's own
table of contents):

```sql
-- Table and row counts
SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;

-- Sequences restarted correctly (spot-check one)
SELECT last_value FROM leads_id_seq; -- adjust per actual sequence name if any are custom
```

Compare row counts per table against what you'd expect from the source at
backup time. A mismatch means the restore is not trustworthy — do not use
it for recovery until you understand why.

## What a database dump does NOT include

A dump only captures the database. These must be recreated separately when
standing up a restored environment:

- `JWT_SECRET`, `WEBHOOK_ENCRYPTION_KEY`, and every other application
  secret (these live in deployment environment variables, not the database).
- API keys shown to users at creation time are stored as salted hashes —
  a restored database can still validate existing keys, but you cannot
  recover a plaintext key value from a dump (same as production).
- Supabase project-level configuration (connection pooler settings, any
  Supabase Auth/Storage configuration — though LeadFlow doesn't use either).
- Email/AI/Sheets provider credentials (Resend, Brevo, OpenAI, Google) —
  these are deployment env vars, not database rows.

## Supabase Storage / uploaded files

The repository audit confirmed LeadFlow does not use Supabase Storage and
has no file-upload handling anywhere in its codebase (no `multer`, no
`storage.from(...)` calls, no `SUPABASE_URL`/`SUPABASE_ANON_KEY`
references). There is nothing outside Postgres to back up or restore.

## If production is unavailable or compromised

1. Do not restore a backup into the production database — stand up a
   separate, disposable instance first (Option A or B above) and inspect
   it there.
2. If credentials may have been exposed, rotate them (Supabase database
   password, `JWT_SECRET`, API keys, provider keys) before reconnecting
   any restored or recovered environment to production traffic.
3. Identify the most recent backup with the data you need (R2 object
   listing, sorted by key — keys are timestamp-ordered).
4. Restore it to a disposable instance, verify it (above), then make a
   deliberate decision about what to do with that data — this project does
   not provide an automated "restore to production" path, intentionally.

## Historical analysis and the 35-day live-data policy

This backup system is **recovery snapshots, not a queryable analytics
store**. Each `.dump` file is a point-in-time export you must restore
before you can query it — there is no standing database you can run
historical reports against directly from R2.

If/when LeadFlow moves to retaining only ~35 days of certain records live
while keeping full history indefinitely in backups, that is a **separate,
future design** (e.g. a dedicated archive table or analytics warehouse fed
by a controlled export process) and is explicitly out of scope here. This
backup system does not delete, truncate, or modify any production record,
and implements no automatic cleanup — it only adds backups on top of
whatever the live database already contains.

## Secrets this system needs (GitHub repository secrets)

| Secret | Used by | Purpose |
|---|---|---|
| `SUPABASE_DB_URL` | `database-backup.yml` | Direct (non-pooled) Postgres connection string, read-only use (`pg_dump` never writes) |
| `R2_ACCOUNT_ID` | both workflows | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | both workflows | R2 API token access key id |
| `R2_SECRET_ACCESS_KEY` | both workflows | R2 API token secret |
| `R2_BUCKET_NAME` | both workflows | The private backup bucket |
| `RESTORE_TEST_DB_URL` | `database-restore-validate.yml` only | A **disposable** Postgres instance — never production |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `database-backup.yml` (optional), `business-data-export.yml` | Secondary Sheets logging — see [docs/GOOGLE_SHEETS_BACKUP_LOGGING.md](./GOOGLE_SHEETS_BACKUP_LOGGING.md) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | `database-backup.yml` (optional), `business-data-export.yml` | Secondary Sheets logging — see [docs/GOOGLE_SHEETS_BACKUP_LOGGING.md](./GOOGLE_SHEETS_BACKUP_LOGGING.md) |

None of these are committed anywhere in the repository. See the setup
checklist in the implementation report for exactly where to find each value.
