# LeadFlow

**Turn leads into customers.**

LeadFlow is a multi-tenant lead capture, qualification, and CRM platform for small businesses and sales teams. It covers the full pipeline — from a public capture form or ad webhook, through duplicate detection, deterministic scoring, automatic assignment, and follow-up scheduling, to a Kanban pipeline, response-SLA tracking, and marketing attribution reporting — with an AI-assisted qualification layer that's fully optional.

## Product overview

```
Facebook / Instagram / Website Form / n8n / API / CSV / Manual
                         │
                         ▼
              Central Lead Intake Service
                         │
        normalize → duplicate check → campaign
        resolution → deterministic score → auto-
        assign (routing rules / round robin) →
        SLA follow-up → automation rules → activity
                         │
                         ▼
       Sales pipeline → Follow-ups → Conversion →
              Revenue & marketing attribution
```

Every way a lead can enter LeadFlow funnels through one service
(`server/src/services/leadIntakeService.ts`), so a form submission, a
Meta ad webhook, an n8n workflow, a CSV import, and a salesperson typing a
lead in by hand all get the same scoring, duplicate detection, assignment,
and follow-up behavior — no source is a second-class citizen.

Leads move through a defined pipeline:

```
New → Contacted → Qualified → Proposal → Negotiation → Won/Lost
```

## Features

- **Multi-tenant accounts** — each business's data is fully isolated; the backend derives tenant identity from the authenticated JWT (or, for public/webhook intake, from a URL slug or a per-business secret) — never from client input.
- **Role-based access** — `owner` (full access: users, business settings, all leads, analytics, integrations) and `sales` (their assigned leads only).
- **Public lead capture forms** — build a form with a small field editor, get a public URL and an iframe embed snippet; submissions create real leads with full UTM/attribution capture, no login required.
- **Duplicate detection & merge** — new leads are matched against existing ones by normalized email/phone; possible duplicates are flagged (never silently dropped) and can be reviewed and merged, preserving notes, activity, and open follow-ups.
- **Deterministic lead scoring & priority** — always available, independent of AI; a transparent 0–100 score maps to a Low/Medium/High/Hot priority band used for routing and SLA targets.
- **AI lead qualification** — provider-agnostic (OpenAI or Anthropic), server-side only, returning a score, summary, reasoning, strengths/concerns, urgency, and a suggested response. If no provider is configured, the CRM keeps working and the UI clearly says AI is unavailable — never a faked result.
- **Automatic lead assignment** — prioritized routing rules (by source/industry/score) with a round-robin fallback across active sales reps; every automatic assignment is logged and notifies the assignee.
- **Automation rules** — simple `WHEN lead created → IF conditions → THEN assign/notify/create follow-up` rules, layered on top of routing.
- **Response SLA tracking** — a configurable per-priority response target (e.g. 15 min for Hot leads) drives an auto-scheduled follow-up and a Met/Missed/Pending status per lead, plus compliance and average-response-time reporting.
- **Lead inbox** — a working queue of new, not-yet-contacted leads with priority and SLA countdown, so nothing new sits unworked.
- **In-app notifications** — a notification bell for lead assignments, hot leads, and automation activity, tenant- and user-scoped with read/unread state.
- **Kanban pipeline** — drag-and-drop or dropdown status changes, with automatic activity logging.
- **Follow-up system** — upcoming / overdue / completed views, scheduling, completion tracking.
- **Marketing attribution** — campaigns auto-aggregate leads by `utm_campaign`; Reports breaks down performance by source and campaign, with real (never invented) revenue from accepted quotations.
- **Integrations** — a generic secret-authenticated webhook for n8n/Zapier/etc., a production-ready Meta (Facebook/Instagram) Lead Ads webhook (signature verification + idempotency, pending your own Meta credentials to go fully live), and business-scoped API keys. See [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).
- **Outreach — outbound personalized email automation** — import contacts from a Google Sheet, build a follow-up sequence, and let AI draft a personalized email per contact (using only the facts you gave it, never inventing details), pass it through a Natural Communication Engine and a Quality Check, and hold it for **mandatory human approval** before anything sends. Approved sends go out through a pluggable email provider, replies are detected and classified, follow-ups automatically stop on reply/bounce/unsubscribe/suppression, and a genuinely engaged reply finds-or-creates the matching CRM lead through the same central intake pipeline as every other source. Runs entirely on realistic mock providers by default — zero cost, zero external calls — and switches to real providers (Resend, OpenAI, Google Sheets) purely via environment variables. See [`docs/OUTREACH.md`](docs/OUTREACH.md).
- **CSV import/export** — validates rows, reports per-row errors, always scopes imported records to the authenticated business, and runs through the same intake pipeline as everything else.
- **Dashboard & reports** — KPI cards, leads-by-status/source, leads-over-time, pipeline value by stage, salesperson performance, source performance, campaign performance, and SLA metrics.
- **User & business settings** — owners manage sales users, business profile, routing rules, automations, integrations, and API keys.

## Architecture

```
React (Vite/TS) ──HTTPS/REST──> Express (TS) ──pg──> PostgreSQL (Supabase)
```

- The frontend never talks to the database directly and never sees database credentials, JWT secrets, webhook secrets, API keys, or AI/Meta API keys.
- All business data access goes through the Express API, which enforces authentication (JWT) or the appropriate alternative (a public form's business/form slug, a webhook's own secret/signature), authorization (role checks), and tenant isolation (every query is scoped by a server-derived `business_id`) on every request.
- SQL is always parameterized (`pg` with `$1, $2, ...` placeholders) — no string interpolation.
- All lead creation, regardless of source, flows through one **Central Lead Intake Service** — see Product overview above.

### Project structure

```
LeadFlow/
├── client/            React + Vite + TypeScript frontend
│   └── src/
│       ├── components/  Reusable UI (tables, badges, dialogs, states, notification bell)
│       ├── pages/       Route-level views (leads, pipeline, inbox, forms, campaigns, settings...)
│       ├── layouts/      App shell / auth shell
│       ├── hooks/        useAuth, useToast
│       ├── services/     Typed API clients
│       ├── lib/          fetch wrapper
│       └── tests/        Vitest + React Testing Library
├── server/            Express + TypeScript backend
│   └── src/
│       ├── controllers/  Request handlers (leads, forms, webhooks, routing, automations, ...)
│       ├── routes/       Route wiring
│       ├── middleware/   auth, role guard, rate limiting, error handling
│       ├── services/     leadIntakeService (central), scoringService, aiService, routingService,
│       │                 automationService, notificationService, metaService, csvService
│       ├── repositories/ Parameterized SQL data access
│       ├── validation/   Zod schemas
│       └── db/           pool, migrate, seed
│   └── tests/          Vitest + Supertest (backend integration tests)
├── database/
│   └── migrations/     SQL migrations (run against Postgres/Supabase)
└── docs/
    ├── PORTFOLIO.md
    ├── INTEGRATIONS.md   Website forms, n8n/webhooks, Meta, API keys — what's live vs. what needs your credentials
    └── OUTREACH.md       Outbound email automation — pipeline, mock vs. real providers, approval gate, scaling
```

> Note: seed data lives in `server/src/db/seed.ts` rather than a static `database/seeds/*.sql` file, since seeding needs runtime logic (bcrypt password hashing, computing each lead's deterministic score). It's still run with a single `npm run db:seed` command.

## Tech stack

**Frontend:** React, Vite, TypeScript, React Router, Tailwind CSS, Lucide React, Recharts, Vitest, React Testing Library.

**Backend:** Node.js, Express, TypeScript, `pg` (node-postgres), Zod, JWT (`jsonwebtoken`), `bcryptjs`, Helmet, `express-rate-limit`, Vitest, Supertest.

**Database:** PostgreSQL, designed for and intended to run on Supabase.

## Database schema

Core: `businesses`, `users`, `leads` (with attribution/SLA/duplicate columns), `follow_ups`, `activities`, `notes`, `quotations`, `ai_qualifications`.

Capture & automation: `lead_forms`, `lead_form_fields`, `campaigns`, `lead_routing_rules`, `round_robin_cursors`, `sla_settings`, `automation_rules`, `notifications`.

Integrations: `integrations` (Meta connection state), `webhooks`, `webhook_deliveries`, `api_keys`.

Plus a `schema_migrations` tracking table. See [`database/migrations/`](database/migrations/) for the full DDL, constraints, and indexes — migrations `001` through `009`, applied in order by `npm run db:migrate`.

## Authentication & security

- Passwords hashed with bcrypt (10 rounds); password hashes are never returned by any endpoint.
- JWT contains only `userId`, `businessId`, and `role` — no sensitive data.
- Every protected route requires a valid JWT (`requireAuth`); owner-only routes additionally require `requireRole('owner')`.
- Public form routes derive the business/form purely from URL slugs; the visitor can never supply a `business_id`.
- The generic webhook endpoint is authenticated by a per-business secret (stored only as a hash); the Meta webhook is authenticated by verifying Meta's `X-Hub-Signature-256` HMAC signature against the raw request body.
- API keys and webhook secrets are shown in full exactly once, at creation/rotation, and stored only as a SHA-256 hash thereafter.
- Tenant isolation: every repository function takes `businessId` and includes it in the `WHERE` clause; it is always derived server-side, never from the request body/query.
- Input validation via Zod on every mutating endpoint; centralized error handler maps validation, conflict, and Postgres errors to appropriate HTTP status codes and never leaks stack traces outside development.
- `helmet` for security headers, `express-rate-limit` (tighter limits on `/auth/*`, public forms, and webhooks), CORS restricted to `CLIENT_URL` in production (permissive for any `localhost` origin in development, to tolerate Vite picking a different port).

## AI integration

```
React → POST /api/leads/:id/qualify-ai → Express → aiService → OpenAI or Anthropic
```

- `AI_PROVIDER` env var selects `openai`, `anthropic`, or `none`.
- If not configured, the endpoint returns HTTP 422 with a clear message; the frontend shows "AI qualification is not configured. Add an AI provider API key to enable this feature." — the rest of the app keeps working normally. No fake AI output is ever generated.
- The AI is asked for a score, qualification (Hot/Warm/Cold), summary, reasoning, strengths, concerns, urgency, a suggested response, and an estimated priority — validated with Zod before being stored in `ai_qualifications`, and always labeled as an AI-generated assessment in the UI.
- Only lead business fields (name, company, industry, source, interest, budget, timeline, description) are sent to the AI provider — never email, phone, passwords, or any secret.

### Deterministic lead scoring & priority (always on, independent of AI)

Implemented in [`server/src/services/scoringService.ts`](server/src/services/scoringService.ts):

| Signal | Points |
|---|---|
| Budget provided | +15 (+5 bonus if ≥ $5,000) |
| Timeline provided | +10 (+10 bonus if urgent language, e.g. "ASAP"/"this week") |
| Email present | +10 |
| Phone present | +10 |
| Source quality | +15 (Referral/Website), +8 (other named source) |
| Interest specified | +15 |
| Description completeness | +15 (≥20 chars), +7 (any) |

Score is capped at 100. The **Lead Score priority** band shown throughout the app: **0–39 Low, 40–69 Medium, 70–84 High, 85–100 Hot** — a transparent label, not a statistical prediction.

## Automatic assignment, automations, and response SLA

- **Settings → Lead Routing**: prioritized rules (`IF source/industry/score ... THEN assign to a person / round robin / owner`), evaluated in priority order — first match wins. No match leaves the lead unassigned.
- **Settings → Automations**: `WHEN a lead is created → IF conditions match → THEN` assign, create an extra follow-up, or notify — layered on top of routing for cases like "score ≥ 85 → notify the owner."
- **Settings → Lead Routing → response time targets**: per-priority minutes (Hot/High/Medium/Low) drive both the auto-scheduled follow-up and each lead's `sla_status` (Pending/Met/Missed), visible as a badge everywhere a lead appears and summarized in Reports (average response time, compliance rate, overdue count).

## Local setup

### 1. Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is enough)

### 2. Get your database connection string
In your Supabase project: **Project Settings → Database → Connection string (URI)**.

### 3. Install dependencies
```bash
npm install
```
This installs both `server/` and `client/` via npm workspaces.

### 4. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and set `DATABASE_URL` to your Supabase connection string, and a strong `JWT_SECRET`. Leave `AI_PROVIDER=none` and the `META_*` variables blank unless you have those credentials — everything else works fine without them.

### 5. Run migrations
```bash
npm run db:migrate
```

### 6. Seed demo data
```bash
npm run db:seed
```

### 7. Start the backend
```bash
npm run dev:server
```
Runs on `http://localhost:4000`.

### 8. Start the frontend
In a second terminal:
```bash
npm run dev:client
```
Runs on `http://localhost:5173`.

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `NODE_ENV` | server | `development` \| `test` \| `production` |
| `PORT` | server | API port (default `4000`) |
| `CLIENT_URL` | server | Allowed CORS origin for the frontend |
| `PUBLIC_APP_URL` | server | Public origin used to build shareable form links, embed snippets, and the webhook URL shown in settings; falls back to `CLIENT_URL` |
| `DATABASE_URL` | server | PostgreSQL connection string (Supabase) |
| `JWT_SECRET` | server | Secret used to sign JWTs — keep private |
| `JWT_EXPIRES_IN` | server | Token lifetime (default `7d`) |
| `AI_PROVIDER` | server | `openai` \| `anthropic` \| `none` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | server | Used when `AI_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | server | Used when `AI_PROVIDER=anthropic` |
| `META_APP_ID` / `META_APP_SECRET` / `META_VERIFY_TOKEN` | server | Only needed to receive real Meta Lead Ads webhooks — see [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) |
| `WEBHOOK_ENCRYPTION_KEY` | server | Encrypts any third-party access token LeadFlow stores at rest (e.g. a Meta Page Access Token) |
| `EMAIL_PROVIDER` / `OUTREACH_AI_PROVIDER` / `SHEETS_PROVIDER` / `INBOUND_PROVIDER` | server | Each defaults to `mock` — the outreach pipeline runs fully on realistic simulated providers with zero cost. See [`docs/OUTREACH.md`](docs/OUTREACH.md) for the real options and how to switch. |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` | server | Real email sending + inbound replies (`EMAIL_PROVIDER=resend` / `INBOUND_PROVIDER=resend`) |
| `GOOGLE_API_KEY` | server | Real Google Sheets import (`SHEETS_PROVIDER=google`) — a public-sheet API key, no OAuth required |
| `OUTREACH_DAILY_SEND_LIMIT` | server | Default daily send cap per business (default `100`), overridable per business in Settings |
| `VITE_API_URL` | client | Base URL of the API, e.g. `http://localhost:4000/api` |

Never commit `.env`. See `.env.example` and `client/.env.example`.

## Demo credentials

Seeded business: **Nova Growth Agency** — includes 16 demo leads across every source and pipeline stage, two demo campaigns, a "Website Contact Form," and three demo routing rules (hot leads to the owner, Instagram round-robins between reps, everything else round-robins by default).

| Role | Email | Password |
|---|---|---|
| Owner | `owner@novagrowth.com` | `Demo1234!` |
| Sales | `alex@novagrowth.com` | `Demo1234!` |
| Sales | `jamie@novagrowth.com` | `Demo1234!` |

## API overview

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me

GET    /api/leads                 GET    /api/leads/:id
POST   /api/leads                 PATCH  /api/leads/:id       DELETE /api/leads/:id
GET    /api/leads/:id/notes       POST   /api/leads/:id/notes
GET    /api/leads/:id/activities  POST   /api/leads/:id/activities
GET    /api/leads/:id/follow-ups
POST   /api/leads/:id/qualify-ai  GET    /api/leads/:id/ai-qualification
POST   /api/leads/import          GET    /api/leads/export
GET    /api/leads/duplicates      POST   /api/leads/merge

GET    /api/pipeline

GET    /api/follow-ups            POST   /api/follow-ups       PATCH /api/follow-ups/:id

GET    /api/forms                 POST   /api/forms (owner)    PATCH/DELETE /api/forms/:id (owner)
GET    /api/forms/:id/embed
GET    /api/public/forms/:businessSlug/:formSlug              (no auth)
POST   /api/public/forms/:businessSlug/:formSlug/submit        (no auth)

GET    /api/campaigns             GET    /api/campaigns/:id

GET    /api/notifications         PATCH  /api/notifications/:id/read   POST /api/notifications/read-all

GET    /api/routing/rules         POST/PATCH/DELETE /api/routing/rules/:id   (owner)
GET    /api/routing/sla           PATCH  /api/routing/sla                    (owner)

GET    /api/automations           POST/PATCH/DELETE /api/automations/:id     (owner)

GET    /api/integrations                                                     (owner)
POST   /api/integrations/webhook  PATCH /api/integrations/webhook            (owner)
GET    /api/integrations/webhook/deliveries                                  (owner)
POST/DELETE /api/integrations/meta                                           (owner)

GET    /api/api-keys              POST   /api/api-keys         DELETE /api/api-keys/:id  (owner)

POST   /api/webhooks/leads                       (generic webhook, secret-authenticated, no JWT)
GET/POST /api/webhooks/meta/leads                (Meta webhook, signature-verified, no JWT)

GET    /api/dashboard
GET    /api/reports

GET    /api/users                 POST   /api/users            PATCH /api/users/:id   (owner only)
GET    /api/business              PATCH  /api/business                                (owner only)

GET/POST /api/outreach/contacts   GET    /api/outreach/contacts/:id
GET/POST /api/outreach/sequences  GET/PATCH /api/outreach/sequences/:id                (owner to write)
GET/POST /api/outreach/campaigns  GET/PATCH /api/outreach/campaigns/:id                (owner to write)
POST   /api/outreach/campaigns/:id/contacts        POST /api/outreach/campaigns/:id/generate-drafts
POST   /api/outreach/campaigns/:id/approve         POST /api/outreach/campaigns/:id/start
POST   /api/outreach/campaigns/:id/pause           POST /api/outreach/campaigns/:id/cancel
GET    /api/outreach/drafts       PATCH  /api/outreach/drafts/:id
POST   /api/outreach/drafts/:id/approve   POST /api/outreach/drafts/:id/reject   POST /api/outreach/drafts/:id/regenerate
GET    /api/outreach/messages     GET    /api/outreach/events    GET /api/outreach/replies
POST   /api/outreach/dev/simulate-reply                          (mock-provider demo/testing only)
GET    /api/outreach/providers    GET    /api/outreach/usage
GET    /api/outreach/suppressions POST   /api/outreach/suppressions   DELETE /api/outreach/suppressions/:email
GET/POST /api/outreach/imports    GET/PATCH /api/outreach/settings                     (owner to write)
POST   /api/outreach/tick                          (JWT or business API key — this is what n8n calls on a schedule)
GET/POST/DELETE /api/integrations/google-sheets                                       (owner only)
POST   /api/webhooks/email/:businessId/inbound     POST /api/webhooks/email/:businessId/status
                                                    (real-provider webhooks, signature-verified, no JWT)
```

## Testing

**Backend** (Vitest + Supertest, run against an in-memory Postgres-compatible engine so tests need no external database):
```bash
npm run test:server
```
**94 tests** covering: signup/login/me, password hashing, invalid/missing JWT rejection, role-based authorization, multi-tenant isolation across every resource (leads, forms, routing rules, automations, integrations, notifications, campaigns — including that one business's webhook secret can never create leads in another), lead CRUD, CSV import/export, AI qualification's graceful "not configured" behavior, deterministic scoring, SQL-injection resistance, dashboard/report aggregate correctness, duplicate detection and merge, response-SLA computation, automatic assignment (routing rules and round robin), automation rule execution, the generic webhook (auth, payload validation, delivery logging), the Meta webhook (verification handshake, signature rejection, idempotent processing), and the full outreach pipeline — the 17-step mock flow (sheet import with dedup → sequence → campaign → AI draft generation → human approval gate → send → mock delivery/bounce simulation → idempotent retries → reply classification → automatic follow-up stopping → CRM lead conversion with no duplicate leads), plus suppression blocking a send even after approval, a pre-suppressed recipient failing quality checks, and owner-only authorization on every write action.

**Frontend** (Vitest + React Testing Library):
```bash
npm run test:client
```
**28 tests** covering: login flow, protected-route redirects, lead creation, lead list filtering, the pipeline board, follow-up creation, the AI qualification UI, the forms list, the lead inbox, the notification bell, the campaigns dashboard, outreach draft review (quality-blocked drafts can't be approved; approval calls the API), and outreach campaign creation/listing.

**Run everything:**
```bash
npm test
```

> The backend test suite uses [`pg-mem`](https://github.com/oguimbal/pg-mem), a Postgres-compatible in-memory engine, purely so integration tests can run without a live database. The application itself always talks to real PostgreSQL via `DATABASE_URL` — there is no separate "test database" architecture in the shipped app.

## Production deployment

- **Frontend → Vercel.** Build command `npm run build --workspace=client`, output directory `client/dist`. Set `VITE_API_URL` to your deployed API's `/api` URL.
- **Backend → Render** (or any Node host). Build command `npm run build --workspace=server`, start command `npm run start --workspace=server` (runs `node dist/server.js`). Set all server env vars from the table above, with `CLIENT_URL` and `PUBLIC_APP_URL` pointing at your Vercel domain.
- **Database → Supabase PostgreSQL.** Run `npm run db:migrate` (and optionally `npm run db:seed`) against your production `DATABASE_URL` before first deploy.

CORS (`CLIENT_URL`), the API base URL (`VITE_API_URL`), and every shareable link (form URLs, embed snippets, webhook URLs) are environment-driven via `PUBLIC_APP_URL` — no hardcoded localhost assumptions in application code. Public form and webhook routes work identically in production; just make sure your Meta App's webhook subscription and any n8n workflow point at your production `PUBLIC_APP_URL`, not localhost.

## License

Portfolio / demonstration project.
