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

The root `vercel.json` builds the app inside `frontend/`:

```json
{
  "framework": "nextjs",
  "installCommand": "cd frontend && npm install",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/.next"
}
```

1. Import the GitHub repo in Vercel (keep Root Directory as the repo root).
2. Add environment variable `NEXT_PUBLIC_API_URL=https://<your-api-host>/api` (Production and Preview).
3. Deploy.

> Alternative that is often more reliable for monorepos: set Vercel's **Root Directory** to `frontend` and delete the custom commands. Use whichever builds cleanly for you. I verified `npm run build` locally; I have not run a Vercel deployment.

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
| `SMTP_HOST/PORT/USER/PASS/FROM` | ✓ for real email | Unset = emails printed to the console |
| `PUBLIC_API_ORIGIN` | ✓ behind TLS proxy | Used to build absolute upload URLs |
| `UPLOAD_GRACE_MINUTES` | | Prune grace period |
| `PAYMENTS_ENABLED`, `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_WEBHOOK_HASH` | only for payments | **All four required together**; the API refuses to boot otherwise |

Commands:

```bash
cd backend
npm ci
npm run db:migrate          # tables, indexes, plans (idempotent)
npm run seed:admin -- --email=… --password=… --name="…"   # once
npm start
```

Health check: `GET /health`.

### Persistent uploads

Uploads are written to `backend/uploads/`. On platforms with ephemeral disks (most PaaS) attach a persistent volume, or move to object storage (planned) before real users upload images.

## Pre-launch checklist

See the checklist in [SECURITY.md](../SECURITY.md#hardening-checklist-before-launch). Also:

- [ ] Backups configured and restore tested
- [ ] Uptime monitor on `/health`
- [ ] Error tracking (e.g. Sentry) on both apps
- [ ] DNS + TLS for app and API domains
- [ ] Flutterwave webhook URL set to `https://<api>/api/billing/webhook` (only when enabling payments)

## Rollback

Frontend: promote a previous Vercel deployment. API: redeploy the previous image/commit; migrations are additive and idempotent, so rolling code back is safe. Restore the DB from backup only for data corruption.
