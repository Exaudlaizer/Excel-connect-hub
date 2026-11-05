# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/). Versions are not yet tagged; entries are grouped by date.

## [Unreleased]

### Added
- Test suite (`backend/tests`, Node test runner + Supertest) and GitHub Actions CI (empty-DB migration x2, tests against Postgres 16, audit, `tsc`, lint, build).
- `backend/src/utils/entitlements.js`: single place for plan limits.
- `DB_SSL`, `DB_SSL_CA`, `DB_POOL_MAX` and opt-in `DB_RLS` (Supabase row-level security) settings.
- Frontend ESLint config (`next/core-web-vitals`); `npm run lint` is now non-interactive.
- The mock payment gateway now throws in production as a second lock behind the boot check.
- `requireVerified` middleware: unverified users can no longer publish jobs, ads, courses, community posts/replies or uploads (403 `EMAIL_NOT_VERIFIED`). Admins must verify their email too, so the platform has a confirmed address for operator alerts (SECURITY S-1).
- Documentation set: `docs/PRD.md`, `ARCHITECTURE.md`, `ARCHITECTURE_DESIGN.md`, `FEATURES.md`, `PLAN.md`, `PROGRESS.md`, `API.md`, `DATABASE.md`, `DEPLOYMENT.md`, `TESTING.md`, plus root `AGENT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`.
- Boot-time guard: the API refuses to start with `PAYMENTS_ENABLED=true` unless `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY` and `FLW_WEBHOOK_HASH` are set (prevents the mock payment driver from granting paid plans).

### Fixed
- `npm run db:migrate` failed on an empty database (`relation "users" does not exist`) despite documenting itself as the fresh-setup path; it now creates missing tables first and seeds missing plans.
- Registration could leave a user without a subscription when plans were not seeded; it is now a single transaction.
- Free-plan limit of one active advertisement was advertised but never enforced; now enforced (`AD_LIMIT_REACHED`, 403). Pending ads count; rejected/expired free the slot; Business Pro and admins are unlimited.

### Changed
- `backend/server.js` now loads `./src/config/db` and `./src/app` directly.
- `vercel.json` replaced with a valid Next.js monorepo configuration (it previously contained a text folder diagram).
- Dependencies: `nodemailer` 9 → 10.3.1; `next` and `eslint-config-next` 14.2.23 → 14.2.35; backend lockfile updated via `npm audit fix` (backend advisories 9 → 4).
- `README.md` refreshed to match the current structure and link the docs.

### Removed
- 33 one-line re-export shim files under `backend/controllers`, `models`, `routes`, `middleware`, `config` and `backend/app.js` (they only forwarded to `backend/src/*`).

### Known issues
- Remaining dependency advisories need a Next.js 15/16 upgrade (frontend) or have no non-breaking fix (backend `moment`/`uuid` via Sequelize).

## 2026-11 and earlier

- Initial platform: auth, roles, jobs, applications, ads, courses, community, services, uploads, billing (disabled), admin analytics, Next.js frontend.
