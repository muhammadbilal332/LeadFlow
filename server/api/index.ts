import { createApp } from '../src/app';
import { ensureDeveloperAccount } from '../src/db/seedDeveloper';

// Vercel serverless entry point. This wraps the exact same Express app
// used by server.ts — no business logic, routes, or middleware differ
// between hosting targets. The only thing that changes is who calls
// app.listen() (a long-running process on Render) vs. who invokes the
// app per-request (Vercel's Node runtime here).
const app = createApp();

// Best-effort, idempotent (see seedDeveloper.ts) — safe to re-run on every
// cold start, since it only ever creates the developer account once and
// no-ops if it already exists.
ensureDeveloperAccount().catch((err) => {
  console.error('Failed to provision developer account:', err instanceof Error ? err.message : err);
});

export default app;
