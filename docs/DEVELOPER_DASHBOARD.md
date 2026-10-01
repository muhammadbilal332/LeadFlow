# LeadFlow Developer/Admin Dashboard

A platform-level console, separate from the CRM, where the system owner can
monitor and manage the entire LeadFlow platform — every business, every
user, every lead, the outreach pipeline, and the n8n/provider integrations
— from one place.

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
  `developer_audit_logs`, `system_events`, `n8n_execution_logs`.
  `012_business_status.sql` — adds `businesses.is_active`. Both purely
  additive; no existing table, column, or row is altered.
- **API**: `/api/developer/*` — overview, businesses (+ deactivate,
  reactivate, delete), users (+ role change, enable/disable), leads
  (cross-tenant, read-only, every view audited), outreach lifecycle, n8n
  status, health, providers, usage, logs, audit.
- **Frontend**: `/developer/login` and `/developer/*` (Overview,
  Businesses, Business detail, Users, Leads, Outreach, n8n, Health,
  Providers, Usage, Logs, Audit, Settings), with their own layout and
  navigation, entirely separate from the CRM's `AppLayout`.

## Business management

A developer can deactivate, reactivate, or permanently delete any tenant
business from the Businesses list or a business's detail page:

- **Deactivate** sets `businesses.is_active = false`. Every user of that
  business is immediately blocked from logging in (`authController.login`
  checks the business's status right after the password check, and returns
  the same generic "Invalid email or password" either way, so a locked-out
  account can't be distinguished from a wrong password by probing). This is
  reversible — **Reactivate** restores access instantly.
- **Delete** permanently removes the business and cascades to everything
  under it (users, leads, outreach campaigns/messages) via the existing
  `ON DELETE CASCADE` foreign keys. This is a two-step, deliberately
  irreversible action: the API refuses to delete a business that is still
  active (400 "Deactivate this business before deleting it"), so a business
  can never be deleted in a single click. The frontend's Delete button is
  disabled while a business is active, for the same reason.
- Every deactivate, reactivate, and delete is recorded to
  `developer_audit_logs`.

## Cross-tenant lead visibility is audited, not restricted

The Leads page intentionally keeps full cross-tenant visibility — it exists
for platform support (debugging a customer's pipeline, verifying import
results) and restricting it would defeat that purpose. Since that means a
developer can see real customer lead data, **every view is logged**: each
call to `GET /api/developer/leads` writes a `developer_viewed_leads` audit
entry recording which business/filter/page was viewed and how many results
came back — so the Audit Logs page is a complete record of who looked at
customer data, when, and why. This is a deliberate trade-off (visibility
for support usefulness, audited for accountability) rather than a gap.

## n8n connection status — how it's really determined

LeadFlow never calls n8n directly (n8n calls LeadFlow's
`POST /api/outreach/tick`), so there's no outbound health check to make.
Instead, every call to that endpoint — success or failure — is recorded to
`n8n_execution_logs` with who triggered it (`api_key` = a real external
caller like n8n, vs `jwt` = someone using the LeadFlow UI's own "Process
queue" button). The dashboard reports **CONNECTED** only when there's been
at least one `api_key`-triggered execution in the last 24 hours — never
just because the route exists or because the UI itself has been clicked.

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
