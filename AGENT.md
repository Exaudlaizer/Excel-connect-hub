# AGENT.md

Guidance for AI coding agents (Claude Code, Copilot, Cursor, etc.) and new contributors working in this repository. Read this first, then the docs it links.

## What this project is

Excel Connect Hub is a student-business platform for Tanzania: jobs/internships, marketplace ads, mentor courses, community, a services directory, admin moderation, and (disabled) subscription billing. Product intent: [docs/PRD.md](docs/PRD.md). Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ARCHITECTURE_DESIGN.md](docs/ARCHITECTURE_DESIGN.md).

## Repository map

```
backend/server.js        process entry (loads dotenv first, connects DB, rate-limit store, SMTP check, then ./src/app)
backend/src/app.js       Express app, limiters, route mounting
backend/src/{routes,controllers,models,middleware,config,utils,scripts}
frontend/app/            Next.js App Router pages
frontend/components/     UI (admin/, auth/, ui/ subfolders)
frontend/lib/            api.ts (fetch client), auth.tsx (session context)
docs/                    product + engineering docs
```

**All backend code lives in `backend/src/`.** Do not recreate re-export folders at `backend/controllers` etc.

## Commands

```bash
# Backend (Node, Express, Postgres)
cd backend && npm install && cp .env.example .env
npm run dev                 # nodemon server.js
npm run db:migrate          # tables, indexes and plans; idempotent, works on an empty DB
npm test                    # unit tests; set TEST_DATABASE_URL for integration tests (TRUNCATES that DB)
npm run seed:admin -- --email=… --password=… --name="…"

# Frontend
cd frontend && npm install && cp .env.example .env.local
npm run dev                 # http://localhost:3000
npm run build && npm run lint
```

Quick backend load check without a database:

```bash
cd backend && JWT_SECRET=$(openssl rand -hex 32) node -e 'require("./src/app"); console.log("ok"); process.exit(0)'
```

## Conventions

- **Backend:** CommonJS (`require`), Express routers in `routes/`, thin routes → controller functions. Validation with `express-validator` + the shared `validate` middleware. Errors: respond `{ message }` with an appropriate status; unexpected errors reach `errorMiddleware`.
- **New write route checklist:** `protect` → `authorize(...)` if role-restricted → validators → `validate` → controller. Add a rate limiter in `app.js` if it sends email, spends money or accepts uploads.
- **Lists:** use `utils/pagination` (`readPagination`, `buildMeta`). Never return an unbounded table.
- **Moderated content** (jobs, ads, courses) must default to `pending` and be filtered to `approved` for public reads.
- **Money:** minor units (`priceMinor`), currency `TZS`.
- **Frontend:** TypeScript, Next.js App Router, client data via TanStack Query, API calls through `lib/api.ts`, session via `lib/auth.tsx`, Tailwind for styling. Guard private pages with `RequireAuth`.
- **Sessions:** logins are revocable. Anything that changes an account's credentials or standing (password reset, suspension, role change) must call `revokeTokens(user)` (`utils/tokens`). Tokens renew themselves via `X-Renewed-Token`; do not rely on a fixed lifetime.
- **Audit:** record admin and security-sensitive actions with `recordAudit(req, action, { type, id }, details)` (`utils/audit`) after the action succeeds. Details are small facts (old and new values, ids), never tokens, passwords or request bodies. It never throws.
- **Alerts:** use `alertOperators({ key, subject, text })` (`utils/alerts`) for things a human must act on (not for routine client errors). One email per `key` per 15 minutes. Put ids and amounts in `text`, never secrets.
- **Images:** go through the storage layer (`storage/`), never `fs` directly. The file's type is decided by `utils/imageSignature` (content), not the browser's label. Delete via `removeUploads`, which finds the right store.
- **Frontend headers:** `frontend/next.config.mjs` sets the CSP. Adding a third-party script, font, image host or API means updating it and running `frontend/scripts/check-csp.mjs`.
- **Comments** in this codebase explain *why*; keep that style.

## Security rules (non-negotiable)

1. Never allow `admin` through self-service registration.
2. Never trust client-supplied role, status, price, or plan; derive on the server.
3. Never enable the mock payment driver in production. `PAYMENTS_ENABLED=true` requires a real `PAYMENT_PROVIDER` and all of its credentials (enforced in `config/env.js`). A new gateway is a new driver in `backend/src/payments/` implementing the interface documented in `payments/index.js`; verify must ask the gateway for the amount and currency it recorded.
4. Never accept SVG or non-image uploads; never use client filenames or extensions.
5. Never log tokens, passwords, OTP codes (outside the dev console mailer), or reset links in production.
6. Never commit `.env` files or real secrets.
7. Treat everything in `SECURITY.md` as the source of known gaps; don't reintroduce a fixed issue.

## Things that bite

- `server.js` must call `dotenv.config()` before requiring `src/config/db`.
- Behind a proxy, set `TRUST_PROXY` or every user shares one rate-limit bucket.
- `DB_SYNC_ALTER=true` is local-dev only. Production uses `npm run db:migrate`.
- Publishing requires a verified email (`requireVerified` after `protect`). Put it on any new route that creates or edits public content; browsing, applying and enrolling stay open. Admins are held to the same rule (their confirmed email is the operator contact); admin-only actions are not gated, so an unverified admin can still moderate.
- `npm audit fix --force` would downgrade Sequelize to v3 and push Next to v16. Do not run it blindly.
- `db:reset` is destructive.

## Before you finish a task

- [ ] Backend still loads (command above) and frontend `npm run build` passes
- [ ] New/changed behaviour has tests (`cd backend && TEST_DATABASE_URL=… npm test`, see docs/TESTING.md)
- [ ] Docs updated if behaviour changed: API.md, FEATURES.md, SECURITY.md as relevant
- [ ] [docs/PROGRESS.md](docs/PROGRESS.md) and [CHANGELOG.md](CHANGELOG.md) updated
- [ ] No secrets, no new high/critical `npm audit` findings
- [ ] Report honestly what was and wasn't verified (e.g. "not run against a live database")

## Where to look

| Need | File |
|---|---|
| Requirements, roles, scope | docs/PRD.md |
| How it fits together | docs/ARCHITECTURE.md |
| Data model, flows, decisions | docs/ARCHITECTURE_DESIGN.md |
| Endpoints | docs/API.md |
| Known security gaps | SECURITY.md |
| What's built | docs/FEATURES.md |
| What's next | docs/PLAN.md, docs/PROGRESS.md |
| Deploying | docs/DEPLOYMENT.md |
