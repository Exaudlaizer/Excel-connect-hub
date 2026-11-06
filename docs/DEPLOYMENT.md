# Deployment

## Topology

| Part | Where | Why |
|---|---|---|
| Frontend (`frontend/`) | **Vercel** | Native Next.js hosting |
| API (`backend/`) | Long-running Node host: Render, Fly.io, Railway, or a VPS | Needs a persistent process, DB pool, and writable disk for uploads. **Not suited to Vercel serverless as written** |
| PostgreSQL | Managed (Neon, Supabase, Render, RDS…) | Backups, TLS |
| Redis | Managed (Upstash, Render, …), optional but recommended | Shared rate-limit counters |
| SMTP | Any provider (Resend, SES, Brevo, …) | Verification and reset emails |

## Frontend on Vercel

The Next.js app lives in `frontend/`, and the repo root has no `package.json`, so Vercel must be told to build from the subfolder. **Set the project's Root Directory to `frontend`** (Project Settings, General, Root Directory). `frontend/vercel.json` only pins the framework.

1. Import the GitHub repo in Vercel and set **Root Directory = `frontend`** before the first deploy.
2. Add the environment variable `NEXT_PUBLIC_API_URL=https://<your-api-host>/api` (Production and Preview). Without it the build still succeeds but the app calls `http://localhost:5000/api`.
3. Deploy. A preview deployment can build before the API exists, but sign-in will not work until the API is reachable.

> History: an earlier root-level `vercel.json` ran `cd frontend && ...` commands. On PR #1 the Vercel deployment failed with that config. The Vercel build log was not available to me, so the cause is **not proven**; the likely one is that Vercel's Next.js detection looks for `next` in the root directory's `package.json`. The Root Directory setting is Vercel's documented fix for monorepos. If the deployment still fails after setting it, read the first error lines in the Vercel build log (or run `npx vercel inspect <deployment> --logs`).

## API

Environment variables (see `backend/.env.example`):

| Variable | Required | Notes |
|---|:-:|---|
| `NODE_ENV=production` | ✓ | |
| `PORT` | | Host usually injects it |
| `DATABASE_URL` | ✓ | Required in production |
| `DB_SSL` / `DB_SSL_CA` | ✓ for hosted DBs | `DB_SSL=true` enables TLS; add the provider CA (PEM, `\n` for newlines) to verify the server |
| `DB_POOL_MAX` | | Default 10; hosted poolers cap connections |
| `DB_RLS=true` | Supabase | `db:migrate` enables row-level security on all tables, closing the public REST Data API. Only if the app connects as the table owner |
| `JWT_SECRET` | ✓ | ≥ 32 chars, random; boot fails on placeholders |
| `JWT_EXPIRES_IN` | | Default `7d` |
| `CLIENT_ORIGIN` | ✓ | Exact frontend origin(s), comma-separated |
| `TRUST_PROXY` | ✓ behind a proxy | Hops to trust (e.g. `1`); otherwise all users share one rate-limit bucket |
| `REDIS_URL` | recommended | Needed once there is more than one instance |
| `ALERT_EMAILS` | recommended | Comma-separated addresses emailed on payment mismatches, bad webhook signatures, repeated server errors and crashes. Empty = every active admin with a verified email. Needs working SMTP to actually deliver |
| `SENTRY_DSN`, `SENTRY_RELEASE` | optional | Error reporting; off when `SENTRY_DSN` is unset |
| `SMTP_HOST/PORT/USER/PASS/FROM` | ✓ for real email | Unset = emails printed to the console |
| `PUBLIC_API_ORIGIN` | ✓ behind TLS proxy | Used to build absolute upload URLs |
| `UPLOAD_GRACE_MINUTES` | | Prune grace period |
| `STORAGE_DRIVER` | | `local` (default) or `supabase` |
| `SUPABASE_URL`, `SUPABASE_BUCKET`, `SUPABASE_SECRET_KEY` | with `supabase` | See "Image storage (Supabase)". The secret key is a secret: API host only |
| `PAYMENTS_ENABLED`, `PAYMENT_PROVIDER` + that provider's credentials | only for payments | `PAYMENTS_ENABLED=true` needs a real provider (not `mock`) and **every** variable it lists (`requiredEnv`); the API refuses to boot otherwise. Leave payments off for a free launch |

Commands:

```bash
cd backend
npm ci
npm run db:migrate          # tables, indexes, plans (idempotent)
npm run seed:admin -- --email=… --password=… --name="…"   # once
npm start
```

Health checks: `GET /health` (liveness) and `GET /health/ready` (readiness: database reachable). Use `/health/ready` for the host health check and uptime monitor.

### Image storage (Supabase)

Set `STORAGE_DRIVER=supabase` to keep uploaded images in Supabase Storage instead of on the API server's disk.

1. In the Supabase dashboard, Storage, **New bucket**. Name it (e.g. `media`) and make it **Public** (images are public by design; the app serves them to everyone).
2. Restrict it: allowed MIME types `image/jpeg, image/png, image/webp, image/gif, image/avif` and a 4 MB file size limit. (Bucket restrictions are a second lock; the API already checks type and size.)
3. Settings, API Keys: copy the project URL and the **secret** key (`sb_secret_...`).
4. On the API host set `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_BUCKET`, `SUPABASE_SECRET_KEY`. The API refuses to boot if any is missing, if the URL is not `https://` in production, or if you paste a publishable key.
5. Upload one image and delete it from the admin panel to confirm. **The driver was written from Supabase's documentation but has not been run against a real project.**

The secret key bypasses every Supabase access rule. Keep it in the API's environment only; if it leaks, rotate it in the dashboard. Images uploaded before the switch stay on local disk and keep working; deleting a record removes each image from whichever store holds it. Orphaned files in a Supabase bucket are not pruned automatically yet (`npm run uploads:prune` covers local disk only).

### Persistent uploads (local driver)

Uploads are written to `backend/uploads/`. On platforms with ephemeral disks (most PaaS) attach a persistent volume, or move to object storage (planned) before real users upload images.

## Pre-launch checklist

See the checklist in [SECURITY.md](../SECURITY.md#hardening-checklist-before-launch). Also:

- [ ] Backups configured and restore tested
- [ ] Uptime monitor on `/health`
- [ ] Error tracking (e.g. Sentry) on both apps
- [ ] DNS + TLS for app and API domains
- [ ] Gateway webhook/callback URL set to `https://<api>/api/billing/webhook` (only when enabling payments)

## Rollback

Frontend: promote a previous Vercel deployment. API: redeploy the previous image/commit; migrations are additive and idempotent, so rolling code back is safe. Restore the DB from backup only for data corruption.
