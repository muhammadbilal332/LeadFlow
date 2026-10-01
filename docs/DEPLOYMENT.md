# Deploying LeadFlow

LeadFlow is split across three services. Netlify only hosts the static
frontend — it can't run the Express backend (no long-running Node process
on Netlify's free tier), so the backend needs a separate host built for
that. Nothing here changes the app itself; it's purely hosting config.

| Part | Host | Cost |
|---|---|---|
| Frontend (React/Vite) | Netlify | Free, incl. a `*.netlify.app` subdomain |
| Backend (Express API) | Render | Free tier (sleeps after 15 min idle; wakes on next request, ~30–60s cold start) |
| Database | Supabase | Already set up — no change |

A real custom domain (`yourbrand.com`) isn't free anywhere legitimate —
registration is typically $10–15/year. The `*.netlify.app` subdomain Netlify
gives you automatically is a real, permanently free option if you don't
need a custom one.

## 0. Push this repo to GitHub

This project isn't in git yet. From the repo root:

```bash
git init
git add .
git commit -m "Initial commit"
```

Then create an empty repo on GitHub (github.com → New repository — don't
initialize it with a README), and push:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## 1. Deploy the backend first (Render)

The frontend needs the backend's URL at build time, so set this up first.

1. Sign up at [render.com](https://render.com) (free, GitHub login works).
2. **New** → **Blueprint** → connect your GitHub repo. Render reads
   [`render.yaml`](../render.yaml) at the repo root and pre-fills the
   service config (root dir `server`, build/start commands, health check).
3. Render will prompt you to fill in every env var marked secret in
   `render.yaml`. Pull the real values from your local `.env`:
   - `DATABASE_URL` — your Supabase connection string
   - `JWT_SECRET` — your real secret
   - Any provider keys you're actually using (`RESEND_API_KEY`,
     `GOOGLE_API_KEY`, etc.) — leave unset ones blank, they default to mock
   - `CLIENT_URL` / `PUBLIC_APP_URL` — leave blank for now, you'll set these
     in step 3 once you know your Netlify URL
4. Deploy. Once live, copy the service URL Render gives you, e.g.
   `https://leadflow-api.onrender.com` — you'll need it next.
5. Run the database migration once against your real Supabase (from your
   own machine, where `.env` already points at it):
   ```bash
   cd server && npm run db:migrate
   ```

## 2. Deploy the frontend (Netlify)

1. Sign up at [netlify.com](https://netlify.com) (free, GitHub login works).
2. **Add new site** → **Import an existing project** → connect the same
   GitHub repo. Netlify reads [`netlify.toml`](../netlify.toml) and
   pre-fills the build settings (base `client`, build command, publish
   `dist`).
3. Before deploying, add one environment variable (**Site configuration →
   Environment variables**):
   - `VITE_API_URL` = `https://leadflow-api.onrender.com/api` (your Render
     URL from step 1, with `/api` on the end)
4. Deploy. Netlify gives you a URL like `https://leadflow-crm.netlify.app`
   — that's your free subdomain. (You can rename it under **Site
   configuration → General → Site details → Change site name**.)

## 3. Connect the two (critical — CORS will block requests without this)

Go back to Render → your service → **Environment**, and set:
- `CLIENT_URL` = your real Netlify URL (e.g. `https://leadflow-crm.netlify.app`, no trailing slash)
- `PUBLIC_APP_URL` = the same value

Save — Render redeploys automatically. The backend only accepts requests
from exactly this origin in production, so the frontend can't reach the API
until this matches.

## 4. Verify

Open your Netlify URL and log in. If login hangs or the console shows CORS
errors, double check `CLIENT_URL` on Render matches the Netlify URL
*exactly* (including `https://`, no trailing slash).

## Later: a real custom domain

If you buy a domain (Namecheap, Cloudflare, Google Domains, etc.), point it
at Netlify under **Site configuration → Domain management → Add a domain**
— Netlify issues a free HTTPS certificate for it automatically. No code
changes needed; `CLIENT_URL`/`PUBLIC_APP_URL` on Render and `VITE_API_URL`
on Netlify would just need updating to the new domain if the Netlify
subdomain changes too.
