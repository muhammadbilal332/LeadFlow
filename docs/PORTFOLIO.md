# LeadFlow

## Description

LeadFlow is a professional SaaS lead-capture, automation, and CRM platform: public capture forms, Meta/n8n webhook intake, duplicate detection, deterministic + AI lead qualification, automatic assignment, response-SLA tracking, a Kanban pipeline, follow-up management, and marketing-attribution reporting. It's built as a realistic, multi-tenant product — not a single-user demo — with the security and data-isolation guarantees a real customer would expect.

## Problem solved

Small businesses, agencies, and independent sales teams routinely manage leads in spreadsheets or scattered notes: no shared pipeline visibility, no consistent follow-up discipline, no objective way to prioritize which leads to chase first. LeadFlow gives a small team a single, shared source of truth for every lead — from first contact to won/lost — with automatic scoring so reps know where to focus, a visual pipeline so managers can see stage-by-stage health at a glance, and a follow-up system that surfaces what's overdue instead of letting it quietly slip.

## Target users

- Marketing and creative agencies
- Sales teams at small-to-medium businesses
- Consultants and freelancers managing their own pipeline
- Local and service businesses (contractors, clinics, studios)

## Technical highlights

- **React + TypeScript** frontend with a component-based architecture, React Router, Tailwind CSS, and Recharts for analytics.
- **Express + TypeScript** REST API with a clean layered architecture: routes → controllers → services/repositories, all parameterized SQL, centralized error handling.
- **PostgreSQL (Supabase)** as the system of record, with a proper migration system, indexes on every high-traffic filter column, and no ORM-magic — plain, auditable SQL.
- **Multi-tenancy done correctly**: tenant identity is derived server-side from the verified JWT on every request; it is never trusted from client input. This is explicitly covered by automated tests (business A cannot read, list, or update business B's records; a spoofed `business_id` in a request body is silently ignored).
- **Role-based access control** (owner vs. sales), enforced both in API middleware and reflected in the UI (protected/role-gated routes, disabled fields, hidden nav items).
- **JWT auth + bcrypt password hashing**, rate-limited auth endpoints, Helmet security headers, Zod validation on every mutating request.
- **Provider-agnostic AI integration**: the AI call lives entirely server-side (`aiService`), is never invoked from the frontend, gracefully degrades to a clear "not configured" state with zero fake output when no API key is present, and is layered on top of (not a replacement for) a deterministic, explainable lead-scoring algorithm.
- **A single Central Lead Intake Service** that every source — public forms, Meta webhooks, generic n8n/API webhooks, CSV import, and manual entry — funnels through, so duplicate detection, scoring, assignment, and follow-up scheduling behave identically regardless of where a lead came from, instead of being re-implemented per endpoint.
- **Production-grade webhook security**: the Meta integration verifies `X-Hub-Signature-256` against the raw request body (not the parsed JSON) and never fabricates lead data it can't verify; the generic webhook is authenticated by a per-business secret stored only as a hash.
- **Automated testing on both ends**: 84 backend tests (Vitest + Supertest) covering auth, authorization, tenant isolation across every new resource, CRUD, CSV import/export, SQL-injection resistance, aggregate-report correctness, duplicate detection/merge, automatic assignment (routing + round robin), automation rules, and both webhook integrations; 22 frontend tests (Vitest + React Testing Library) covering the core user flows plus forms, inbox, notifications, and campaigns.
- **Real bugs caught and fixed during manual verification** — see below.

## Portfolio value

This project demonstrates the full slice of skills a commercial SaaS product actually requires, not just CRUD scaffolding:

- Designing a normalized relational schema with proper constraints and indexing for a genuinely multi-entity domain (leads, follow-ups, activities, notes, quotations, AI qualifications) under a shared tenant model.
- Reasoning about and testing *security boundaries*, not just happy paths — tenant isolation and role authorization are treated as first-class, explicitly tested behaviors.
- Building a provider-agnostic third-party integration (AI qualification) with a proper disabled/degraded state, instead of either hard-coding a vendor or faking output when unconfigured.
- End-to-end manual verification in a real browser caught two genuine bugs that unit tests alone had missed (an API response missing a joined field, and an aggregate query pattern that silently returned wrong per-salesperson numbers) — both were root-caused, fixed, and back-filled with regression tests rather than just patched over.
- Writing an API and data layer that's honest about its own limits — pagination, server-side filtering, and indexed queries instead of "load everything and filter in JS."

## Future commercial features

Deliberately **not** built now, to keep scope focused on a correct, secure core product:

- Full Meta OAuth connect flow and a UI for storing a Page Access Token (the webhook receiver, signature verification, and idempotent processing are built and tested — see `docs/INTEGRATIONS.md` for exactly what remains and why)
- WhatsApp / email inbox integration (currently: source-tracking only)
- Calendar integration for follow-ups
- Email/SMS delivery for notifications (currently in-app only)
- Stripe subscription billing for a real multi-tenant SaaS offering
- Deeper reporting (cohort analysis, forecasting)
- AI-drafted outreach emails
- A full AI "sales assistant" chat interface over a business's lead data
- A guided first-run onboarding wizard
