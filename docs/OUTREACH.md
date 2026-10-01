# LeadFlow Outreach — outbound personalized email automation

Outreach extends LeadFlow with a full cold-email pipeline: import contacts,
build a follow-up sequence, let AI draft a personalized email per contact,
pass every draft through automated quality checks, hold it for **mandatory
human approval**, send it, detect and classify replies, automatically stop
follow-ups when appropriate, and convert a genuinely engaged reply into a
CRM lead — through the same central intake pipeline every other lead source
uses.

```
Google Sheet (or mock dataset)
        │  sheetsImportService — dedup by email, upsert, never a duplicate contact
        ▼
outreach_contacts
        │  added to an outreach_campaign (which references an outreach_sequence)
        ▼
personalizationService (AIProvider) ──> naturalCommunicationEngine ──> qualityCheckService
        │                                                                  │
        │                                              blocked/warnings/passed
        ▼
outreach_drafts (status: draft)
        │  <<< HUMAN APPROVAL — REQUIRED. Nothing below this line runs without it. >>>
        ▼
outreachQueueService ──(EmailProvider.sendEmail)──> outreach_messages / outreach_events
        │
        ▼
   reply arrives (real webhook, or the mock simulate-reply endpoint)
        │
        ▼
replyProcessingService: classify (rule-based) → stop all follow-ups for that
        contact → suppress if unsubscribe → find-or-create CRM lead (search by
        email first — never a duplicate) → notify the assigned salesperson
```

## Everything works today with zero paid APIs

Every provider defaults to **mock**, which is not a stub — it's a fully
functional simulated implementation:

| Provider | Env var | Mock behavior |
|---|---|---|
| Email sending | `EMAIL_PROVIDER=mock` | "Sends" instantly, tracks per-business daily/monthly usage in memory, simulates a hard bounce for any recipient containing `bounce` and a rejection for any containing `fail` |
| AI personalization | `OUTREACH_AI_PROVIDER=mock` | Deterministic template that only ever uses fields you actually gave it — it has no generative capability, so it *cannot* invent a fact |
| Google Sheets import | `SHEETS_PROVIDER=mock` | Returns a fixed, realistic 8-row dataset every time — good enough to run the whole pipeline end to end in a demo |
| Inbound replies | `INBOUND_PROVIDER=mock` | No real mailbox exists to receive a reply, so `POST /api/outreach/dev/simulate-reply` drives a reply through the exact same code path a real webhook would use |

This is a deliberate architectural choice, not a shortcut: every service in
`server/src/services/outreach/*` talks to a `EmailProvider` / `AIProvider` /
`SheetsProvider` / `InboundProvider` **interface**
(`server/src/providers/*/*.ts`), never to a concrete implementation.
Switching providers is an environment-variable change — no business logic
is touched.

## Switching to real providers

None of this is required to use Outreach — it's how you go from demo to
production once you're ready.

### Email — Resend (`EMAIL_PROVIDER=resend`)
1. Create a free [Resend](https://resend.com) account and verify a sending domain.
2. Set `RESEND_API_KEY`.
3. (Optional, for delivery-status webhooks) set `RESEND_WEBHOOK_SECRET` and
   configure Resend to POST to `{PUBLIC_APP_URL}/api/webhooks/email/{your-business-id}/status`.

Resend only verifies a full domain via DNS — it will always reject a sender
address at a personal mailbox (gmail.com, yahoo.com, etc.), since nobody can
prove ownership of those domains.

### Email — Brevo (`EMAIL_PROVIDER=brevo`)
1. Create a free [Brevo](https://brevo.com) account (300 emails/day, no
   credit card) and add a sender under **Senders, Domains & Dedicated IPs →
   Senders** — Brevo can verify a single sender *address* via a
   confirmation-link click, not only a full domain, so it can accept a send
   from a personal inbox that Resend would always reject outright. For real
   deliverability (not landing in spam), still add and verify a domain you
   own under the same section — a verified address alone gets you past
   Brevo's own validation, but without SPF/DKIM alignment on a real domain,
   mail is still likely to be flagged by Gmail/Outlook on the receiving end.
2. Set `BREVO_API_KEY` (Brevo dashboard → SMTP & API → API Keys).
3. (Optional, for delivery-status webhooks) set `BREVO_WEBHOOK_SECRET`,
   then in Brevo's webhook settings add a transactional webhook pointing to
   `{PUBLIC_APP_URL}/api/webhooks/email/{your-business-id}/status` with a
   custom header `X-Webhook-Secret: <same value>` — Brevo doesn't sign
   webhook payloads the way Resend/Svix does, so this shared-secret header
   is what `BrevoEmailProvider.parseStatusWebhook` checks instead.

### AI personalization — OpenAI (`OUTREACH_AI_PROVIDER=openai`)
Reuses the existing `OPENAI_API_KEY` / `OPENAI_MODEL` already used by lead
qualification. Note this is a **separate switch** from `AI_PROVIDER` — that
one controls lead qualification only, so the two features can never
interfere with each other.

### Google Sheets — real import (`SHEETS_PROVIDER=google`)
1. Create a Google Cloud API key with the Sheets API enabled, set `GOOGLE_API_KEY`.
2. Share your sheet as "Anyone with the link can view."
3. In **Settings → Integrations → Google Sheets**, save the spreadsheet ID and range.

This uses the free Sheets API v4 `values.get` endpoint with a simple API
key — no OAuth flow. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
`GOOGLE_REDIRECT_URI` are reserved for a future private-sheet OAuth flow and
are not wired up yet.

### Inbound replies — Resend (`INBOUND_PROVIDER=resend`)
Requires Resend's inbound email + a `RESEND_WEBHOOK_SECRET`, and DNS/MX
configuration on Resend's side (outside this codebase's control). Configure
the webhook URL as `{PUBLIC_APP_URL}/api/webhooks/email/{your-business-id}/inbound`.

## The approval gate

Nothing sends without a human clicking Approve. Concretely:
- `outreach_drafts.status` starts at `draft` and can only become `approved`
  via `POST /api/outreach/drafts/:id/approve` — a real user action.
- A draft whose quality check returned `blocked` (e.g. a suppressed
  recipient, a missing subject, content over 250 words) **cannot** be
  approved; the API rejects it with 400 until it's fixed or regenerated.
- The send phase (`outreachQueueService.sendApprovedDrafts`) only ever looks
  at `outreach_campaign_contacts` in the `approved` state — there is no code
  path that sends an unapproved draft.
- Suppression is re-checked immediately before every send, not just at
  draft time, closing the race between "approved" and "sent."

## Follow-ups and stopping conditions

A sequence's steps run one at a time. After a step sends, the next step's
draft is generated when its scheduled time arrives (`delay_days` after the
previous step) and goes through the same approval gate — it is never
auto-sent just because an earlier step was approved.

Follow-ups permanently stop, and the contact is marked accordingly, when:
- **Any reply arrives** — positive, negative, or an out-of-office.
- **Unsubscribe** is detected in a reply, or added manually.
- **A bounce** occurs (the mock provider simulates this for any address containing `bounce`).
- **A contact is manually suppressed** (Outreach → Suppressions).
- **The campaign is paused or cancelled.**

## Reply classification & lead conversion

Classification is deterministic and rule-based
(`server/src/services/outreach/replyClassifier.ts`) — not AI — so the same
reply text always classifies the same way, which matters for automatically
stopping follow-ups. Categories: `interested`, `meeting_request`,
`question`, `not_interested`, `unsubscribe`, `wrong_person`, `referral`,
`out_of_office`, `unknown`.

An `interested` / `meeting_request` / `question` / `referral` reply
triggers lead conversion: `leadRepo.findPotentialDuplicate` searches for an
existing lead by normalized email **first** — a match is reused (an
activity note is added, the assigned rep is notified) and no new lead is
created. Only when no match exists does it create one, through the same
`intakeLead()` central intake service every other lead source uses, so
scoring, assignment, and SLA scheduling all still apply.

## Scale-safe design (target: ~25,000 emails/month)

- **Queue, not immediate bulk-send.** Approving a draft marks it eligible;
  actual sending happens when `outreachQueueService` runs, either from the
  UI's "Process queue now" button or `POST /api/outreach/tick`.
- **n8n as an orchestration layer, not a state owner.** In production, an
  n8n scheduled workflow calls `POST /api/outreach/tick` (authenticated with
  a LeadFlow API key from Settings → API keys, via `requireAuthOrApiKey`)
  every few minutes. n8n never holds outreach state — LeadFlow remains the
  sole source of truth for every contact, draft, message, and reply.
- **Idempotency.** Every send has an `idempotency_key` (`draft:<draftId>`)
  on `outreach_messages`; a retried tick can never double-send the same
  draft, and Resend also receives the same key as its own `Idempotency-Key`
  header.
- **Rate limiting.** `email_settings.daily_send_limit` (default from
  `OUTREACH_DAILY_SEND_LIMIT`) is checked before every send; once hit,
  further sends fail cleanly rather than exceeding a provider's limits.
- **Usage tracking.** `provider_usage` tracks sent/failed/bounced counts per
  business, per provider, per day and month — visible in Outreach →
  Overview and in `GET /api/outreach/usage`.

## n8n orchestration — set up, verified working

**LeadFlow owns business state. n8n owns orchestration.** n8n never talks to
Supabase directly and never contains CRM logic — it only calls LeadFlow's
API on a schedule and reports the result. This has been built and executed
end-to-end against a real local n8n instance (Docker, `n8nio/n8n`), not just
documented.

**Workflow**: `LeadFlow - Automated Outreach Engine`, with three entry
points that all lead to the same call:
- **Schedule Trigger** — every 15 minutes by default (a safe interval for
  local testing; tune `minutesInterval` for your volume).
- **Manual Trigger** — for on-demand execution from the n8n editor.
- **Webhook** (`POST /webhook/leadflow-outreach-tick` once the workflow is
  active) — for triggering from an external system.

Each feeds into one **HTTP Request** node, `Call LeadFlow Tick`:
`POST {LEADFLOW_URL}/api/outreach/tick`, authenticated with an n8n
**HTTP Header Auth** credential holding `Authorization: Bearer <LeadFlow API
key>` — the same API key mechanism already used elsewhere (Settings → API
keys), never a hardcoded secret in the node itself. From inside a Docker
container, `LEADFLOW_URL` is `http://host.docker.internal:4001` in local
dev.

The HTTP node's output branches (`onError: continueErrorOutput`) into two
**Code** nodes:
- `Log Success` — parses `{draftsGenerated, sent, blocked, failed}` from
  LeadFlow's response and logs a plain-English summary. This is the honest
  business result for the cycle — `failed: 1` is logged here too, since a
  per-contact send rejection is a normal, expected outcome of a tick, not an
  HTTP-level error.
- `Log Failure` — only reached if the HTTP call itself fails (LeadFlow
  unreachable, timeout, non-2xx). Logs the error and explicitly does
  **not** retry — `retryOnFail` is left off. LeadFlow's own idempotency
  (the `idempotency_key` on `outreach_messages`) guarantees the next tick
  can safely re-attempt without ever double-sending.

**Idempotency, verified**: running the workflow twice in a row against the
same approved draft only sends once; the second run finds no eligible work
(`sent: 0`) because the campaign_contact already moved to a terminal state.

**Failure handling, verified**: a send rejected by the mock provider is
recorded as `outreach_messages.status = 'failed'` with a `failed_reason`,
the campaign_contact moves out of `approved` (so it is never silently
retried forever), and a second tick against the same contact correctly
finds zero eligible work rather than re-attempting or double-reporting it.

**How to run it yourself**:
1. Generate a LeadFlow API key: Settings → API keys → New key.
2. In n8n, create an HTTP Header Auth credential named e.g. "LeadFlow API
   Key" with header `Authorization` = `Bearer <key>`.
3. Build the workflow above (or import the JSON — see
   `n8n import:workflow --input=<file>` if you're scripting it), pointing
   the HTTP Request node at your LeadFlow instance's `/api/outreach/tick`.
4. Toggle the workflow active to enable the schedule/webhook, or use n8n's
   own "Execute Workflow" button / `n8n execute --id=<id>` for a one-off
   run.
5. Switching from the mock email provider to Resend later requires zero
   changes on the n8n side — n8n only ever calls `/api/outreach/tick`; which
   provider actually sends the email is entirely a LeadFlow-side
   `EMAIL_PROVIDER` env var.

**Deployment note**: n8n should run as its own separate service (its own
container/host), reachable from LeadFlow's network only insofar as it needs
to call LeadFlow's public API URL with an API key — it does not need
LeadFlow's database credentials, JWT secret, or any server-side secret
beyond the one API key you issue it.

## Security

- Every outreach table is `business_id`-scoped, and `business_id` is always
  derived from the authenticated session (or a validated API key) — never
  from the request body.
- Real-provider webhooks (`/api/webhooks/email/:businessId/inbound` and
  `/status`) verify the provider's signature before processing anything.
- Real access tokens, if ever stored, would use the same
  `WEBHOOK_ENCRYPTION_KEY` AES-256-GCM encryption-at-rest already used for
  the Meta integration — no plaintext secrets at rest.
- The `/api/outreach/dev/simulate-reply` endpoint is a no-op unless
  `INBOUND_PROVIDER=mock`, so it can never be used to spoof a reply on a
  business running a real inbound provider.

## Database schema

17 tables, all `business_id`-scoped: `sheet_connections`, `sheet_imports`,
`outreach_contacts`, `outreach_sequences`, `outreach_sequence_steps`,
`outreach_campaigns`, `outreach_campaign_contacts`, `outreach_drafts`,
`outreach_messages`, `outreach_events`, `email_threads`, `email_replies`,
`suppressions`, `email_settings`, `provider_usage`, `ai_generation_logs`,
`outreach_audit_logs` — see `database/migrations/010_outreach.sql`.
