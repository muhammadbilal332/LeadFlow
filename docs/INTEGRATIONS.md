# LeadFlow Integrations

Every integration below funnels leads through the same **Central Lead Intake
Service** (`server/src/services/leadIntakeService.ts`): normalize → duplicate
check → campaign resolution → score → assign → schedule follow-up → run
automation rules. No integration re-implements this pipeline.

Status key:
- ✅ **IMPLEMENTED** — fully built and covered by automated tests; works today with no external credentials.
- 🔧 **READY FOR CONFIGURATION** — fully built, but needs a value only you can provide (a secret, a page ID) before it does anything.
- 🔑 **REQUIRES EXTERNAL CREDENTIALS** — the architecture is complete and tested for everything on LeadFlow's side, but going live also requires credentials from a third party (Meta) that only exist once you register there. This has **not** been tested against a live Meta webhook in this environment — do not treat it as live until you've done that yourself.

---

## 1. Website lead capture forms — ✅ IMPLEMENTED

Build a form in **Forms → New form**, add fields, save. Each form gets a
public URL: `{PUBLIC_APP_URL}/f/{your-business-slug}/{form-slug}`.

- The public route requires no authentication and never accepts a
  `business_id` from the visitor — the business and form are resolved purely
  from the two slugs in the URL.
- UTM parameters on the URL (`?utm_source=instagram&utm_campaign=launch`) are
  automatically captured and stored on the resulting lead.
- Submissions run through full intake: scoring, duplicate detection,
  automatic assignment (if you've configured routing rules), and an
  auto-scheduled follow-up.

**Embedding**: every form's detail page shows a public URL and an iframe
snippet (Copy Link / the embed code box). The snippet never executes
arbitrary visitor-supplied HTML/JS — it's a static `<iframe>` pointing at
your own LeadFlow-hosted form.

## 2. Generic webhooks (n8n, Zapier, or anything else) — 🔧 READY FOR CONFIGURATION

Go to **Settings → Integrations** and click **Generate webhook secret**. You
get:
- A URL: `POST {PUBLIC_APP_URL}/api/webhooks/leads`
- A secret, shown once — store it in your automation tool.

Send requests with the secret in an `X-Webhook-Secret` header:

```bash
curl -X POST https://your-domain/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <your secret>" \
  -d '{
    "name": "Ahmed Khan",
    "email": "ahmed@example.com",
    "phone": "+92...",
    "company": "Example Ltd",
    "message": "I need a website",
    "source": "instagram",
    "campaign": "website-audit",
    "utm_source": "instagram",
    "utm_campaign": "website-audit"
  }'
```

Every request is authenticated by the secret (hashed at rest — the raw
secret is never stored), validated with Zod, and logged to a delivery log
visible in Settings → Integrations (status, timestamp, error if any). Rotate
the secret any time; the old one stops working immediately.

**n8n setup**: add an HTTP Request node, method `POST`, URL as above, header
`X-Webhook-Secret`, JSON body mapped to the fields above.

## 3. Meta (Facebook/Instagram) Lead Ads — 🔑 REQUIRES EXTERNAL CREDENTIALS

**What's built and tested (no credentials needed):**
- `GET /api/webhooks/meta/leads` — the webhook verification handshake Meta
  requires when you subscribe a webhook (`hub.mode`/`hub.verify_token`/`hub.challenge`).
- `POST /api/webhooks/meta/leads` — verifies Meta's `X-Hub-Signature-256`
  HMAC signature against the raw request body before processing anything.
  An invalid or missing signature is always rejected (403); this is not
  disabled in any environment.
- Parsing of Meta's `leadgen` webhook event structure (page ID, form ID,
  leadgen ID, ad ID, ad set ID).
- Idempotent lead creation keyed on `(business_id, external_source='meta', external_id=leadgen_id)`
  — a redelivered webhook event never creates a duplicate lead.
- A settings UI (**Settings → Integrations**) to record which Meta Page ID
  belongs to your business, so incoming events can be routed to the right
  tenant.

**What genuinely requires your own Meta credentials:**

Meta's leadgen webhook event only contains *IDs* — not the lead's actual
name/email/phone. Fetching the real submitted data requires calling the
Graph API with a **Page Access Token**, which only exists once you've done
Meta's app setup. LeadFlow will not fabricate lead data — if no page access
token is configured for a page, an incoming webhook event is logged and
safely ignored (Meta still gets its required `200 OK` so it doesn't disable
the subscription).

To go fully live:
1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com), add the **Webhooks** and **Lead Ads** products.
2. Set `META_APP_ID`, `META_APP_SECRET`, and a `META_VERIFY_TOKEN` (any string you choose) in your server's `.env`.
3. In the Meta App's Webhooks settings, subscribe to `leadgen` events for your Page, with callback URL `{PUBLIC_APP_URL}/api/webhooks/meta/leads` and the same verify token.
4. Generate a Page Access Token for the connected Page and store it (this requires a small code change to call `configureMeta` with a token, since the current UI only captures the Page ID — see `server/src/repositories/integrationRepo.ts` `upsertIntegration`'s `accessTokenEncrypted` parameter). Set `WEBHOOK_ENCRYPTION_KEY` in `.env` so the token is encrypted at rest (AES-256-GCM) rather than stored in plaintext.
5. In **Settings → Integrations**, enter the Page ID so LeadFlow knows which business incoming events belong to.
6. Submit a real test lead through Meta's Lead Ads testing tool and confirm it appears in LeadFlow.

Until step 6 has actually been done, this integration should be described as
built and ready, not as "connected" or "live."

## 4. API keys — ✅ IMPLEMENTED

**Settings → Integrations → API keys** (or **Settings → API keys**) lets an
owner create a key for server-to-server use. The full key (`lf_...`) is
shown exactly once, at creation. Only a SHA-256 hash is stored. Revoke a key
any time; revocation is immediate and irreversible.

## 5. Campaigns & attribution — ✅ IMPLEMENTED

Any lead arriving with a `utm_campaign` value (from a form, webhook, or
Meta ad) is automatically grouped into a campaign (find-or-create by
`utm_campaign` per business). **Campaigns** shows leads, qualified count,
won count, and revenue (from accepted quotations linked to those leads) per
campaign — computed from real data, never invented.

## Security notes that apply to every integration above

- Tenant isolation: every intake path resolves `business_id` server-side
  (from a URL slug, a webhook secret, or an authenticated session) — never
  from a client-supplied field.
- Public form and webhook routes have their own rate limits, separate from
  the authenticated API.
- Webhook and API-key secrets are stored only as hashes; nothing is ever
  returned in plaintext after creation.
- The frontend never receives a Meta access token, a webhook secret (after
  creation), or an API key (after creation).
