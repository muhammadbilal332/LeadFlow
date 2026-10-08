# LeadFlow Developer/Admin Dashboard

A platform-level console, separate from the CRM, where the system owner can
monitor LeadFlow's own operation — users, the outreach pipeline, the
scheduler/provider integrations, health, and logs — from one place.

LeadFlow is a standalone single-business application (one deployment, one
`businesses` row for the real business — currently SellerClutch — plus one
scaffolding business that exists only to hold the `developer` account; see
"Business management" below). This console used to also manage multiple
customer businesses on a shared platform; that cross-business
administration was removed when LeadFlow was converted to standalone. What
remains here is operational monitoring, not tenant administration.

## Architecture: one auth system, not two

The developer role (`developer`) is just a third value alongside `owner`
and `sales` in the existing `users.role` column, authenticated through the
**same** `/api/auth/login` endpoint and the **same** JWT mechanism as every
other account. There is no second, parallel authentication system — the
developer login page (`/developer/login`) is a different **frontend**
form/route pointed at the identical backend endpoint.

- A developer account is provisioned once, at server startup, from
  `DEVELOPER_EMAIL` / `DEVELOPER_PASSWORD` env vars (see below) — never
  through the public signup form, and the generic user-management API can
  never assign the `developer` role to an account.
- Every `/api/developer/*` route is independently protected by
  `requireAuth` + `requireRole('developer')` — the frontend's route guard
  (`DeveloperRoute`) is a UX convenience only, never the real security
  boundary. Anonymous → 401. Sales/owner → 403. Only `developer` → 200.
- Session handling reuses the app's existing JWT-in-localStorage mechanism
  (with the standard 401/403 handling, and the existing login rate limiter
  at `/api/auth/login`). Introducing a separate cookie-based session just
  for this one role would mean maintaining two auth systems side by side —
  more attack surface, not less — so this deliberately reuses what's
  already there rather than being "improved" in isolation.

## Setting up the developer account

In the server's `.env`:

```
DEVELOPER_EMAIL=developer@yourcompany.example
DEVELOPER_PASSWORD=some-strong-password-you-choose
```

On the next server start, if both are set and no user with that email
exists yet, LeadFlow creates a dedicated "LeadFlow Platform" business and a
`developer`-role user once. Restarting again never touches it — so you can
safely rotate the env values without them being silently re-applied to an
already-existing account (change the password through the account itself,
not by editing `.env` after first boot).

Leave both blank to disable the dashboard entirely — the routes still
exist, but nobody can ever log in to them without a real developer account
existing in the database.

## What's new

- **Migrations**: `database/migrations/011_developer_dashboard.sql` — adds
  `developer` to the `users.role` check constraint, plus three new tables:
  `developer_audit_logs`, `system_events`, `automation_execution_logs`
  (originally `n8n_execution_logs`, renamed in `019_rename_automation_execution_logs.sql`
  once LeadFlow stopped depending specifically on n8n for scheduling).
  `012_business_status.sql` — adds `businesses.is_active`. Both purely
  additive; no existing table, column, or row is altered.
- **API**: `/api/developer/*` — overview, users (+ role change,
  enable/disable), outreach lifecycle, scheduler status, health, providers,
  usage, logs, audit.
- **Frontend**: `/developer/login` and `/developer/*` (Overview, Users,
  Outreach, Automation Scheduler, Health, Providers, Usage, Logs, Audit,
  Settings), with their own layout and navigation, entirely separate from
  the CRM's `AppLayout`.

## Business management (removed)

Earlier versions of this console let a developer list every business on the
platform and deactivate, reactivate, or permanently delete any of them
(`/api/developer/businesses*`), plus browse leads across every business
(`/api/developer/leads`, cross-tenant). Both were removed when LeadFlow was
converted to a standalone single-business application — there is no longer
a second business to switch to or administer. The only remaining
multi-row fact about the `businesses` table is the scaffolding row that
holds the `developer` account itself (see "Setting up the developer
account" above); it has no CRM data and is never shown as a tenant to
manage.

`businesses.is_active` and the login check that blocks a deactivated
business's users still exist in the schema and in
`authController.login` — there is just no UI/API path to toggle it
anymore. It remains available as a manual, direct-database kill switch if
the real business's account ever needs an emergency lockout.

## Automation scheduler connection status — how it's really determined

LeadFlow never calls the scheduler directly (the scheduler calls LeadFlow's
`POST /api/outreach/tick`), so there's no outbound health check to make.
Instead, every call to that endpoint — success or failure — is recorded to
`automation_execution_logs` (originally `n8n_execution_logs` — renamed once
LeadFlow stopped depending on n8n specifically; the table was always
scheduler-agnostic) with who triggered it
(`api_key` = a real external caller, vs `jwt` = someone using the LeadFlow
UI's own "Process queue" button). The dashboard reports **CONNECTED** only
when there's been at least one `api_key`-triggered execution in the last 24
hours — never just because the route exists or because the UI itself has
been clicked.

## Security notes

- No password hashes, API keys, JWTs, or connection strings are ever
  returned by any `/api/developer/*` endpoint or rendered in the UI —
  Settings/Health/Providers show configuration *status* only (Connected /
  Mock / Not configured), never values.
- Every role change, enable/disable, and business/user inspection is
  recorded to `developer_audit_logs` with actor, action, target, and
  result.
- A developer account's own role/status can't be changed through the
  developer Users page — that's a deliberate guard against a compromised
  session self-escalating or disabling other developer accounts through
  this path.
