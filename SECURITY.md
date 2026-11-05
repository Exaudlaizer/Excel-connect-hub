# Security

Security posture, known gaps, and how to report a vulnerability.
Last reviewed: 2026-11-05 (manual code read; **no automated scan or penetration test has been run**).

## Reporting a vulnerability

Please do **not** open a public issue. Email the maintainer (add a monitored address here before launch: `security@<your-domain>`) with steps to reproduce. Aim to acknowledge within 3 working days.

## What is already in place

| Area | Control | Where |
|---|---|---|
| Passwords | bcrypt, cost 12; min 8 chars | `models/User.js`, `routes/authRoutes.js` |
| Sessions | JWT signed with `JWT_SECRET`; boot fails if the secret is missing, a known placeholder, or under 32 chars in production | `config/env.js` |
| Authorisation | `protect` (valid token, active user), `authorize(...roles)`; suspended users get 401/403 | `middleware/authMiddleware.js` |
| Publishing gate | Unverified emails cannot publish jobs, ads, courses, posts or uploads | `middleware/authMiddleware.js` (`requireVerified`) |
| Admin creation | `admin` role cannot be self-registered; CLI only | `authController.js`, `scripts/createAdmin.js` |
| Brute force | Login 10 failed/15 min/IP; reset 5-10/h; OTP: 60 s cooldown, 5 guesses | `app.js`, `otpController.js` |
| Reset tokens | Random, stored only as SHA-256, single use, 60 min expiry | `passwordResetController.js` |
| Account enumeration | Login returns one generic message for bad email/password | `authController.js` |
| Headers / CORS | Helmet; CORS allow-list from `CLIENT_ORIGIN` | `app.js` |
| Input validation | express-validator on write routes; JSON/body limit 1 MB | `routes/*`, `app.js` |
| Uploads | Image MIME allow-list, SVG blocked, 4 MB cap, random filenames, `nosniff`, no directory listing | `uploadController.js`, `app.js` |
| Payments | Server-side verify of amount and currency; webhook signature with timing-safe compare; idempotent | `billingController.js`, `utils/flutterwave.js` |
| Query safety | Sequelize parameterised queries; pagination clamped (max 100) | `utils/pagination.js` |
| Secrets | `.env*` git-ignored; `.env.example` has placeholders only | `.gitignore` |

## Known gaps and findings

Severity is my judgement of impact for this app. Statuses: **Open**, **Verify** (needs a test to confirm).

| ID | Severity | Status | Finding | Recommended fix |
|---|---|---|---|---|
| S-1 | ~~High~~ | **Fixed 2026-11-05** | **Email verification was not enforced server-side.** | New `requireVerified` middleware (403 `EMAIL_NOT_VERIFIED`) on publish routes: create/edit jobs, ads and courses, community posts and replies, uploads. Browsing, applying and enrolling stay open to unverified users; admins are exempt. Still to add: automated tests (PLAN.md Phase 1). |
| S-2 | Medium | Open | **Token in `localStorage`.** Any XSS can exfiltrate the JWT. There is no server-side revocation, and the default lifetime is 7 days. | Shorter access token plus httpOnly refresh cookie; add a token version on `User` to allow revocation on password change/suspension. Add a strict CSP on the Next.js app. |
| S-3 | Medium | Open | **No CSP / security headers on the frontend.** `next.config.mjs` sets none (Helmet only covers the API). | Add `headers()` with CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS. |
| S-4 | Medium | Open | **Rate limits are per-IP only** for login. Distributed or campus-NAT attacks are weakly constrained, and shared NAT can lock out legitimate users. | Add per-account lockout/backoff on repeated failed logins. |
| S-5 | Low | Open | **Uploads on local disk**, served from the API origin. The type check relies on the client-declared MIME type, with no content sniffing. | Verify magic bytes (e.g. `file-type`), move to object storage with a separate domain, add malware scanning if documents are ever allowed. |
| S-6 | ~~High~~ | **Fixed 2026-11-05** | **Mock payment driver could grant paid plans free.** With no Flutterwave keys the mock driver echoes the expected amount, and checkout only checked `PAYMENTS_ENABLED`. | `assertEnv()` now refuses to boot if `PAYMENTS_ENABLED=true` without `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY` and `FLW_WEBHOOK_HASH`. Still recommended: also refuse the mock driver whenever `NODE_ENV=production`. |
| S-7 | Low | Open | **Role escalation endpoint.** `PATCH /users/:id/role` accepts `admin`. It is admin-only, but it is a high-value target and has no audit trail. | Add an audit log; require re-authentication for role changes. |
| S-8 | Low | Open | **No audit logging** of admin actions (approvals, suspensions, deletions). | Add an `audit_logs` table. |
| S-9 | Medium | Partly fixed | **Dependency vulnerabilities (`npm audit --omit=dev`).** On 2026-11-05: backend 9 reduced to 4 (moderate) after `npm audit fix` and upgrading nodemailer to 10.3.1 (fixed the high/critical `body-parser`, `multer`, `nodemailer`, `proxy-addr`). Remaining backend: `moment`, `uuid`, `qs`/`sequelize` chain (moderate; audit's only "fix" downgrades Sequelize to v3, so it is not applied). Frontend: Next.js moved 14.2.23 to 14.2.35, but 4 advisories remain (`next`, `postcss`, `nanoid`, `source-map-js`) whose fixes need Next 15/16 (a breaking upgrade). | Plan a Next.js 15/16 upgrade; enable Dependabot; run `npm audit` in CI. |
| S-10 | Low | Open | **Database TLS.** `config/db.js` sets no `ssl` option; managed Postgres usually requires it. | Add `dialectOptions.ssl` driven by an env flag. |
| S-11 | Info | Open | **Unauthenticated webhook** by design; protected only by signature. Make sure `FLW_WEBHOOK_HASH` is set whenever payments are enabled. | Fail boot when payments are enabled without it. |

## Hardening checklist before launch

- [x] Fix S-1 (server-side verification gate for publishing)
- [ ] Set a random `JWT_SECRET` of 48+ bytes; never reuse across environments
- [ ] `NODE_ENV=production`, `TRUST_PROXY` set correctly for the host
- [ ] `CLIENT_ORIGIN` set to the exact production origin(s)
- [ ] Redis configured for shared rate-limit counters
- [ ] Real SMTP configured; boot check passes
- [ ] DB TLS on, least-privilege DB user, backups tested
- [ ] `PAYMENTS_ENABLED` and Flutterwave keys and webhook hash consistent
- [ ] Frontend security headers/CSP in place
- [ ] `npm audit` clean (or accepted); Dependabot on
- [ ] Admin account created with a strong unique password
- [ ] Privacy policy and terms published (the platform stores personal data of young people)

## Data protection notes

The platform stores names, emails, phone numbers, CV links and application text, often for users aged 18-25. Treat this as personal data: collect the minimum, honour deletion requests (`onDelete: CASCADE` already removes dependent rows), and review Tanzania's Personal Data Protection Act obligations with a qualified adviser before launch. *This document is not legal advice.*
