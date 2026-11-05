# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/). Versions are not yet tagged; entries are grouped by date.

## [Unreleased]

### Added
- Documentation set: `docs/PRD.md`, `ARCHITECTURE.md`, `ARCHITECTURE_DESIGN.md`, `FEATURES.md`, `PLAN.md`, `PROGRESS.md`, `API.md`, `DATABASE.md`, `DEPLOYMENT.md`, `TESTING.md`, plus root `AGENT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`.
- Boot-time guard: the API refuses to start with `PAYMENTS_ENABLED=true` unless `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY` and `FLW_WEBHOOK_HASH` are set (prevents the mock payment driver from granting paid plans).

### Changed
- `backend/server.js` now loads `./src/config/db` and `./src/app` directly.
- `vercel.json` replaced with a valid Next.js monorepo configuration (it previously contained a text folder diagram).
- Dependencies: `nodemailer` 9 → 10.3.1; `next` and `eslint-config-next` 14.2.23 → 14.2.35; backend lockfile updated via `npm audit fix` (backend advisories 9 → 4).
- `README.md` refreshed to match the current structure and link the docs.

### Removed
- 33 one-line re-export shim files under `backend/controllers`, `models`, `routes`, `middleware`, `config` and `backend/app.js` (they only forwarded to `backend/src/*`).

### Known issues
- Email verification is not enforced server-side (SECURITY.md S-1).
- Remaining dependency advisories need a Next.js 15/16 upgrade (frontend) or have no non-breaking fix (backend `moment`/`uuid` via Sequelize).

## 2026-11 and earlier

- Initial platform: auth, roles, jobs, applications, ads, courses, community, services, uploads, billing (disabled), admin analytics, Next.js frontend.
