# Transferring LeadFlow to the client's GitHub and Supabase

This is the one-time handover guide for moving LeadFlow from the
developer's own GitHub account to the client's (`SellerClutch998`), and
from whatever Supabase project was used during development to the
client's own. **Every step below that touches a real GitHub account or a
real Supabase project is a manual step for a human with the right
credentials — nothing here was executed from the development environment,
which has no GitHub API access and no Supabase connection string.** See
the "What this guide does not do" section before you start.

## 0. What this guide does not do

- It does not create, transfer, or change visibility on any GitHub
  repository. No `gh` CLI or GitHub token was available when this was
  written — every GitHub step below is something you (or whoever holds
  the right account credentials) runs yourself.
- It does not connect to, inspect, or modify any Supabase project. No
  Supabase connection string, access token, or dashboard session was
  available. "Prepared" below means: the code/config/docs are ready for
  you to point at a real project; it does not mean a real project has
  been touched.
- It does not touch hosting (Vercel), DNS, SMTP, or email provider
  configuration — out of scope for this change, same as before.

## 1. Audit findings (as of this change)

- **Current repository**: `https://github.com/muhammadbilal332/LeadFlow`
  (branch `main`, clean working tree at the time of this change). Commit
  history goes back to a single `Initial commit` — there is no earlier,
  separate history to lose.
- **No secrets in git history.** `.env` was never committed (checked with
  `git log --all --diff-filter=A -- .env`); the only tracked `.env*` files
  are `.env.example` and `client/.env.example`, which contain placeholders
  only (e.g. `postgresql://postgres:postgres@localhost:5432/leadflow`, a
  standard local-dev default, not a real credential). A repo-wide grep for
  API-key-shaped and private-key-shaped strings found nothing beyond that
  placeholder.
- **No Supabase Auth, Storage, or RLS usage anywhere.** LeadFlow connects
  to Supabase's Postgres with the plain `pg` driver via `DATABASE_URL`
  (and a separate `SUPABASE_DB_URL` for the backup system — see
  docs/DATABASE_BACKUP_AND_RESTORE.md) and has its own `users` table, its
  own bcrypt password hashing, and its own JWT issuance
  (`server/src/utils/jwt.ts`). There are **no `CREATE POLICY` / `ROW LEVEL
  SECURITY` statements anywhere** in `database/migrations/` — every bit of
  multi-tenant isolation is enforced in the Express layer (`WHERE
  business_id = $1` on every query), not by Postgres. This matters a lot
  for Phase 3/5 below: there is no Supabase Auth user table to migrate
  into, and no RLS policy set to replicate on the destination project.
- **Schema**: 20 migration files, `database/migrations/001_init.sql`
  through `020_backup_sheet_config.sql`, run in filename order by
  `server/src/db/migrate.ts` (idempotent — a `schema_migrations` table
  tracks which have already applied). One extension (`pgcrypto`, for
  `gen_random_uuid()`), five `updated_at` triggers (`businesses`, `users`,
  `leads`, `notes`, `quotations`). Every business-scoped table has
  `business_id ... REFERENCES businesses(id) ON DELETE CASCADE` — deleting
  one `businesses` row cleanly removes every row that depends on it, with
  no orphans and no need for a blanket `TRUNCATE`.
- **Demo data mechanism found and fixed** (see section 4) —
  `server/src/db/seed.ts` inserts a fabricated "Nova Growth Agency"
  business with 16 fake leads, notes, quotations, and routing rules.
  Confirmed **not** wired into any automatic path (not called from
  `server.ts`, not called from `server/api/index.ts` which is the actual
  Vercel entry point, no `postinstall`/build hook, no GitHub Actions
  workflow) — it only ever runs via the explicit `npm run db:seed`
  command. The one real risk was a human running that command with
  production credentials loaded by mistake; see section 4 for the guard
  added against that.
- **A second, smaller demo-data leak found and fixed**: the real,
  production login page (`client/src/pages/LoginPage.tsx`) hardcoded a
  "Demo credentials" box showing `owner@novagrowth.com` / `Demo1234!` to
  every visitor, regardless of whether the seed script had ever actually
  been run. Removed outright (see section 4) — this was a frontend
  constant, not data, so there is nothing to "clean up" in any database
  for this one.
- **GitHub Actions workflows** (`.github/workflows/`): `outreach-tick.yml`
  (scheduler), `database-backup.yml`, `business-data-export.yml`,
  `database-restore-validate.yml`. None of them run the demo seed, create
  a GitHub repository, or touch repository ownership/visibility — nothing
  here needs to change for this task.
- **No public signup endpoint** (`server/src/routes/auth.routes.ts` only
  has `POST /login` and `GET /me`). This meant there was no production-
  safe way to create the client's real owner account on a fresh database
  without either running the demo seed or hand-writing a SQL insert with
  a fabricated password hash — both explicitly things to avoid. Section 5
  adds a third option, matching the pattern this app already uses for its
  developer account.
- **Stale, out of scope, left untouched**: `render.yaml`, `netlify.toml`,
  and `docs/DEPLOYMENT.md` at the repo root describe an earlier, abandoned
  Render+Netlify hosting plan and don't reflect the app's actual Vercel
  deployment. Flagging this for visibility since it's exactly the kind of
  thing a new team inheriting this repo could be misled by — but cleaning
  it up is a hosting-adjacent documentation change, which this task was
  explicitly scoped to leave alone. Worth a separate, deliberate pass.

## 2. GitHub: transferring ownership to `SellerClutch998`

Two ways to do this; pick based on whether you want the original repo to
keep existing under the developer's account afterward.

### Option A — GitHub's native repository transfer (recommended)

Preserves the exact commit history, SHAs, issues, and PRs with zero
re-upload. The **current** owner must initiate it, and `SellerClutch998`
must accept it.

1. As the current owner (`muhammadbilal332`), go to the repository →
   **Settings** → scroll to **Danger Zone** → **Transfer ownership**.
2. Enter `SellerClutch998` as the new owner, confirm the repo name, and
   submit.
3. GitHub sends `SellerClutch998` a transfer request by email/notification
   — they must accept it before anything actually moves.
4. **Before transferring**, set the repository to private if it isn't
   already: **Settings** → **General** → **Danger Zone** → **Change
   visibility** → **Make private**. (Transfer doesn't change visibility
   either direction — confirm it's private both before and after.)
5. After acceptance, verify directly:
   ```bash
   gh repo view SellerClutch998/LeadFlow --json owner,visibility
   ```
   This should print `"login": "SellerClutch998"` and
   `"visibility": "PRIVATE"`. Do not consider the transfer complete until
   this command (or the equivalent repository page) confirms both.
6. Existing local clones' `origin` remote will need updating:
   ```bash
   git remote set-url origin https://github.com/SellerClutch998/LeadFlow.git
   ```

### Option B — Create a new private repo under `SellerClutch998` and push a mirror

Use this if the current owner can't/won't use Option A (e.g. wants to keep
the original repo too), or if `SellerClutch998` wants a repo under a name
different from `LeadFlow`. This still preserves full commit history and
all branches — it's a mirror push, not a re-upload of files.

1. Whoever controls `SellerClutch998` creates a new **empty** repository
   there (no README, no `.gitignore`, no license — an empty repo avoids
   merge conflicts on the first push): **private**, e.g.
   `github.com/SellerClutch998/LeadFlow`.
2. Someone with push access to the current repo (or `SellerClutch998`,
   once added as a collaborator with write access to the current repo)
   runs:
   ```bash
   git clone --mirror https://github.com/muhammadbilal332/LeadFlow.git
   cd LeadFlow.git
   git push https://github.com/SellerClutch998/LeadFlow.git --mirror
   ```
   `--mirror` pushes every branch, tag, and the full history exactly as
   it exists — nothing is rewritten.
3. Verify ownership and visibility the same way as Option A, step 5.

### Either way

- **Do not force-push** over an existing, non-empty destination repo —
  if `SellerClutch998/LeadFlow` already exists and has content, stop and
  inspect it first (clone it, `git log`, see what's there) rather than
  overwriting anything.
- Don't claim the transfer is done until a `gh repo view` (or the GitHub
  UI) actually shows owner `SellerClutch998` and visibility `private`.
  This environment has no GitHub credentials, so that verification has
  to happen on your side.

## 3. Supabase: connecting to the client's project

Since LeadFlow only ever talks to Supabase via two plain Postgres
connection strings (no SDK, no Auth, no Storage), "migrating to the
client's Supabase project" is purely a matter of **where those two
strings point**, plus running the existing migration runner once against
the new destination.

### 3.1 Before touching anything — check what's already there

From a machine with the client's real `DATABASE_URL` (Supabase dashboard
→ Project Settings → Database → Connection string → URI), run read-only
checks first:

```sql
-- Does this project already have LeadFlow's schema, or anything at all?
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;

-- If leads/businesses/users already exist, how much is in them?
SELECT (SELECT count(*) FROM businesses) AS businesses,
       (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM leads) AS leads;
```

If this returns existing LeadFlow tables with real-looking data, **stop**
— that's either an already-migrated environment or someone else's data.
Confirm with the client before running anything further. If it returns no
tables (truly empty project), you're clear to proceed to 3.2.

### 3.2 Run the schema migration

```bash
cd server
DATABASE_URL="<client's real connection string>" npm run db:migrate
```

This runs every file in `database/migrations/` in order, tracked in a
`schema_migrations` table so it's safe to re-run (already-applied files
are skipped). This creates the full schema — tables, the `pgcrypto`
extension, triggers, indexes, constraints — with zero rows in any table.

### 3.3 Point both deployments at it

- The app's own `DATABASE_URL` (Vercel env var on the backend project).
- The backup system's `SUPABASE_DB_URL` — a **separate**, **direct**
  (non-pooled) connection string, deliberately kept apart from the
  pooled `DATABASE_URL` the live app uses, so a backup run never competes
  with real traffic for the pooler's connection budget. See
  docs/DATABASE_BACKUP_AND_RESTORE.md for exactly why and how this is
  used, and `R2_*`/`GOOGLE_*` secrets if the client also wants the
  secondary Sheets backup from that system.

Changing Vercel environment variables is a hosting-configuration action —
explicitly out of scope for this task to perform. The two bullets above
are what needs to change, for whoever does touch Vercel's settings next.

### 3.4 No RLS policies to port over

Re-confirming from section 1: this schema has none. Nothing to copy from
the old project's policy set, because there isn't one — multi-tenant
isolation lives entirely in the application code.

## 4. Demo data — what was found, and what changed

| Source | What it was | Fix |
|---|---|---|
| `server/src/db/seed.ts` | Inserts a fake "Nova Growth Agency" business, 3 users, 16 leads, notes, quotations, a capture form, routing rules | Confirmed never auto-run (no build/start/CI path calls it). Added `assertNotProduction()`: refuses to run when `NODE_ENV=production` unless `ALLOW_SEED_IN_PRODUCTION=yes-i-am-sure` is explicitly set — so a shell with production credentials loaded can no longer run `npm run db:seed` against the real database by accident. |
| `client/src/pages/LoginPage.tsx` | Hardcoded "Demo credentials" box on the real login page, shown to every visitor | Removed outright — no replacement needed. |

### If demo data somehow already exists on a target database

Every row the seed script creates hangs off one `businesses` row (name
`'Nova Growth Agency'`), and every business-scoped table cascades on that
row's deletion (section 1). So the cleanup is one precisely-scoped
statement, never a blanket `TRUNCATE`/`DELETE`:

```sql
-- 1. Verify first — see exactly what would be removed, and nothing else.
SELECT id, name, created_at FROM businesses WHERE name = 'Nova Growth Agency';
SELECT count(*) FROM leads WHERE business_id = (SELECT id FROM businesses WHERE name = 'Nova Growth Agency');
SELECT count(*) FROM users WHERE business_id = (SELECT id FROM businesses WHERE name = 'Nova Growth Agency');

-- 2. Only once the above looks exactly like the demo data and nothing else:
DELETE FROM businesses WHERE name = 'Nova Growth Agency';

-- 3. Verify it's gone, and that nothing else changed.
SELECT count(*) FROM businesses;  -- should drop by exactly 1
```

This was not run against any database — no connection was available from
this environment. These are the exact statements to run yourself, against
whichever database you've confirmed (via 3.1) is safe to modify.

## 5. Owner and developer accounts

Both of LeadFlow's roles are plain rows in its own `users` table (role
`owner` / `developer`), authenticated through the same `/api/auth/login`
and JWT as everyone else — never Supabase Auth (section 1). Passwords are
bcrypt-hashed via `server/src/utils/password.ts`'s `hashPassword()`, the
same function every other account uses; nothing here fabricates a hash or
writes one directly into the database by hand.

### Developer account — `muhammadbilala104@gmail.com`

Already has a dedicated bootstrap mechanism from before this task — see
docs/DEVELOPER_DASHBOARD.md. Set on the backend deployment:

```
DEVELOPER_EMAIL=muhammadbilala104@gmail.com
DEVELOPER_PASSWORD=<a real password you choose, set directly in Vercel, never committed>
```

On the next cold start against the target database, if no user with that
email exists yet, LeadFlow creates a dedicated platform-scaffold business
and this one `developer`-role account. Restarting again never touches it
again (idempotent) — change the password through the account itself
afterward, not by re-editing the env var.

### Owner account — `contact@sellerclutch.com`

New in this task — `server/src/db/seedOwner.ts` (`ensureOwnerAccount()`,
wired into both `server.ts` and `server/api/index.ts`, mirroring the
developer bootstrap exactly). Set on the backend deployment:

```
OWNER_EMAIL=contact@sellerclutch.com
OWNER_PASSWORD=<a real password you choose, set directly in Vercel, never committed>
OWNER_NAME=<whatever display name you want for this account>
OWNER_BUSINESS_NAME=<the real business's name, e.g. "SellerClutch">
```

On the next cold start, if all three of `OWNER_EMAIL`/`OWNER_PASSWORD`/
`OWNER_BUSINESS_NAME` are set and no user with `OWNER_EMAIL` exists yet,
this creates the one real business and its first `owner`-role account.
Same idempotency guarantee as the developer bootstrap: safe to leave the
env vars set permanently, since a second run is always a no-op once the
account exists.

### What this does not do

- It doesn't grant the developer account owner privileges, or vice versa
  — they're two separate rows with two separate roles, exactly as the
  existing role system already enforces (`requireRole('owner', ...)` /
  `requireRole('developer')` throughout the API).
- It doesn't touch any existing account. If a user with either email
  already exists (e.g. this has already been run once), both bootstrap
  functions no-op silently — nothing is overwritten.
- It doesn't set these environment variables for you. That's a Vercel
  dashboard action (Settings → Environment Variables on the backend
  project) — outside what this environment can reach, and outside this
  task's explicit scope (no hosting changes).
- **Verifying both accounts can actually sign in** has to happen after
  the env vars are set and a real deploy has occurred — not done here.

## 6. Checks run before this was committed

- `cd server && npx tsc --noEmit` — clean.
- `cd client && npx tsc --noEmit` — clean.
- `cd client && npx vite build` — succeeds.
- `cd server && npx vitest run` — full suite passing (see the commit this
  guide ships with for the exact count), including the pre-existing
  `tests/seed.test.ts`, which still passes because it runs under
  `NODE_ENV=test`, not `production` — the new guard only blocks a literal
  production environment.
- Repo-wide grep for API-key-shaped and private-key-shaped strings, and a
  full git-history check for any ever-committed `.env` file — both clean
  (section 1).
- Confirmed (by reading the actual route file) that no public signup
  endpoint exists, and (by reading `server.ts` / `server/api/index.ts`)
  that only the two intended bootstrap functions run automatically on
  startup — no demo-data path runs automatically anywhere.

What this section does **not** include, because it requires access this
environment doesn't have: a real migration run against any Supabase
project, a real GitHub transfer, or a real login as either new account.

## 7. Rollback / recovery

- **GitHub (Option A, native transfer)**: ownership transfers are
  themselves reversible the same way — the new owner can transfer back.
  Nothing about the repo's content changes during a transfer, so there's
  nothing to "restore" beyond ownership itself.
- **GitHub (Option B, mirror push)**: the original repository under
  `muhammadbilal332` is untouched by a mirror push elsewhere — it remains
  a complete fallback with full history for as long as it isn't deleted.
- **Supabase schema migration**: `npm run db:migrate` only ever adds
  (new tables/columns/constraints), consistent with every migration file
  in this repo being additive-only. There is no destructive migration to
  roll back. If a migration run needs to be undone entirely on a fresh
  project, the simplest rollback is deleting and recreating the Supabase
  project itself (since 3.2 only ever ran against a confirmed-empty
  destination).
- **Demo-data cleanup (section 4)**: take a backup first regardless — see
  docs/DATABASE_BACKUP_AND_RESTORE.md for the existing, tested R2 backup/
  restore system. A manual `pg_dump` immediately before running the
  `DELETE FROM businesses ...` statement is the minimum safety net if
  that system isn't configured yet for the destination project.
- **Owner/developer account bootstrap**: idempotent and additive only —
  there's nothing to roll back. If a wrong password was set, log in and
  change it, or update the env var and manually update that one row's
  `password_hash` via the account's own password-change flow (never by
  hand-editing the database).
