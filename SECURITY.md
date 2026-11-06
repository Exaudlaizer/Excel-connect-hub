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
| Payments | Server-side verify of amount and currency; webhook signature with timing-safe compare; idempotent | `billingController.js`, `payments/*` (one driver per gateway) |
| Query safety | Sequelize parameterised queries; pagination clamped (max 100) | `utils/pagination.js` |
| Secrets | `.env*` git-ignored; `.env.example` has placeholders only | `.gitignore` |

## Known gaps and findings

Severity is my judgement of impact for this app. Statuses: **Open**, **Verify** (needs a test to confirm).

| ID | Severity | Status | Finding | Recommended fix |
|---|---|---|---|---|
| S-1 | ~~High~~ | **Fixed 2026-11-05** | **Email verification was not enforced server-side.** | New `requireVerified` middleware (403 `EMAIL_NOT_VERIFIED`) on publish routes: create/edit jobs, ads and courses, community posts and replies, uploads. Browsing, applying and enrolling stay open to unverified users. Admins are **not** exempt: a confirmed admin email is the contact for system alerts. Still to add: automated tests (PLAN.md Phase 1). |
| S-2 | Medium | **Partly fixed 2026-11-06** | **Token in `localStorage`; no revocation; 7-day lifetime.** | Logins now last 24 hours and renew while the person is active, and every login can be cancelled at once: a password reset, suspension (or reinstatement), role change or "Sign out on all devices" bumps the account's `tokenVersion` and all earlier tokens stop working. Verified in a real browser, including renewal across the two origins. **Still open:** the token is still in `localStorage`, so an attacker who can run script on the page can read it; moving to an httpOnly cookie plus refresh token is a larger change (CORS with credentials, CSRF protection, cross-site cookie rules between Vercel and the API host) that should be done and tested on a real deployment. |
| S-3 | ~~Medium~~ | **Partly fixed 2026-11-06** | **No security headers or CSP on the frontend.** | Every page now sends `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and (production) `Strict-Transport-Security`; `X-Powered-By` is removed. Verified in a real browser across 28 pages and admin tabs, with a negative control proving foreign scripts, connections and frames are blocked (`frontend/scripts/check-csp.mjs`). **Still open:** `script-src` allows `'unsafe-inline'` (Next.js and the theme bootstrap need inline scripts), so the policy does **not** stop an attacker who can inject an inline script; closing that needs per-request nonces (middleware plus dynamic rendering). Fonts still load from Google (allowed by exact host); self-hosting them would let those two hosts go. Not yet checked on the deployed Vercel site. |
| S-4 | ~~Medium~~ | **Fixed 2026-11-06** | **Login throttling was per-IP only.** | A second limit of 5 failed attempts per 15 minutes per account, keyed on a hash of the submitted email, so an address with no account is throttled identically and nothing is revealed. It shares the Redis store when configured. **Trade-off:** someone who knows a victim's email can lock password logins for that account for up to 15 minutes by failing five times; they cannot learn anything from it, and the owner can still reset their password by email. |
| S-5 | Low | **Mostly fixed 2026-11-06** | **Uploads trusted the client-declared type and lived on local disk.** | The file's real type is now decided from its content (JPEG, PNG, GIF, WebP, AVIF signatures); a script or executable labelled `image/png`, or an image whose label disagrees with its bytes, is refused, and the stored extension comes from the detected type. Storage is pluggable: `STORAGE_DRIVER=supabase` keeps images in a public Supabase bucket instead of on the API's disk. **Still open:** the Supabase driver has not been run against a real project (written from Supabase's official docs and tested against a stand-in), local disk is still the default, a valid image with extra data appended (a "polyglot") is not detected (mitigated by serving images with `X-Content-Type-Options: nosniff` and from a separate origin once on Supabase), and pruning orphaned files from a Supabase bucket is not built. |
| S-6 | ~~High~~ | **Fixed 2026-11-05** | **Mock payment driver could grant paid plans free.** The mock driver echoes the expected amount, and checkout only checked `PAYMENTS_ENABLED`. | `assertEnv()` refuses to boot if `PAYMENTS_ENABLED=true` with the mock provider or without every credential the chosen provider needs; `getProviderByName` also refuses the mock whenever `NODE_ENV=production`. Covered by tests. |
| S-7 | ~~Low~~ | **Fixed 2026-11-06** | **Role escalation endpoint.** `PATCH /users/:id/role` can create admins and had no trail. | Every role and status change is written to the audit log with before/after and who did it, and revokes the target's logins. (Re-authentication for role changes is not implemented.) |
| S-8 | ~~Low~~ | **Fixed 2026-11-06** | **No audit logging of admin actions.** | `audit_logs` table and `GET /api/admin/audit` (admin only), plus an Activity tab. Records approvals/rejections, edits and deletes of other people's content, suspensions, role changes, service changes, pinning, sign-out-everywhere, password resets and payment verification failures. Rows are append-only through the app; tokens, passwords and bodies are never stored. |
| S-9 | Medium | Partly fixed | **Dependency vulnerabilities (`npm audit --omit=dev`).** On 2026-11-05: backend 9 reduced to 4 (moderate) after `npm audit fix` and upgrading nodemailer to 10.3.1 (fixed the high/critical `body-parser`, `multer`, `nodemailer`, `proxy-addr`). Remaining backend: `moment`, `uuid`, `qs`/`sequelize` chain (moderate; audit's only "fix" downgrades Sequelize to v3, so it is not applied). Frontend: Next.js moved 14.2.23 to 14.2.35, but 4 advisories remain (`next`, `postcss`, `nanoid`, `source-map-js`) whose fixes need Next 15/16 (a breaking upgrade). | Plan a Next.js 15/16 upgrade; enable Dependabot; run `npm audit` in CI. |
| S-10 | ~~Low~~ | **Fixed 2026-11-05** | **Database TLS.** No `ssl` option existed. | `DB_SSL=true` enables TLS; `DB_SSL_CA` verifies the server (warns if omitted). Verified the flag is applied; not yet tested against Supabase. |
| S-12 | Medium | **Fixed 2026-11-05** | **Supabase Data API exposure (anticipated, not yet deployed).** Supabase serves public-schema tables over REST with a public key; tables without RLS would be readable and writable. | `DB_RLS=true` makes `db:migrate` enable RLS on every table with no policies; the app (table owner) is unaffected (tested). Re-run migrate after adding tables. Confirm with an anon-key request after deploying. |
| S-13 | Medium | **Fixed 2026-11-05** | **Half-created accounts.** If the Free subscription insert failed (e.g. plans not seeded) registration returned 500 but left the user behind, and retries said the email was taken. | Registration is one transaction; `db:migrate` now seeds missing plans. Regression test added. |
| S-14 | Medium | **Fixed 2026-11-05** | **Student IDs leaked in the public course list.** `GET /courses` returned the raw course row including `enrolledStudents` (the IDs of every enrolled student) to anyone, although the code comments say the roster never leaves the server. Create, edit and approve responses leaked it too. | All course responses go through `publicCourse()` (count plus the caller's own `isEnrolled`). Regression tests; mutation-checked. |
| S-15 | Medium | **Fixed 2026-11-05** | **Job moderation bypass.** An owner could edit an *approved* job (e.g. replace the description) and it stayed live without review, unlike ads and courses. | An owner's content edit returns the job to `pending`; closing a job and admin edits are unaffected. Regression tests for jobs, ads and courses. |
| S-16 | Medium | **Fixed 2026-11-05** | **Account enumeration via public email verification.** `POST /auth/verification/confirm-public` answered differently for an unknown address ("not correct or has expired") than for a registered one ("N attempts left", "request a new code"), contradicting its own comment. Also the attempts-left counter was off by one (first wrong guess said 3 left; the 4th wrong guess claimed the code was burned). | The public endpoint returns one identical 400 for every failure; the signed-in endpoint keeps detailed messages. Counter corrected. Tests assert known and unknown addresses are indistinguishable. |
| S-17 | Low | **Fixed 2026-11-05** | **Phone confirmation survived a number change.** A user could confirm one number and then swap in another while `phoneVerified` stayed true. | Changing the number clears `phoneVerified`; re-sending the same number does not. Test added. |
| S-18 | Medium | **Fixed 2026-11-06** | **Stack traces sent to clients unless `NODE_ENV` was exactly `production`.** A deployment with the variable unset or misspelled (`staging`, `prod`) would hand file paths and internal messages to anyone who triggered a server error. | Stacks are now included only when `NODE_ENV` is `development` or `test`; anything else hides them. Tested for six values. |
| S-11 | ~~Info~~ | **Mitigated 2026-11-05/06** | **Unauthenticated payment webhook** by design; protected only by signature. | The boot check requires the chosen gateway's webhook secret whenever payments are enabled; a bad signature is rejected with 401 and emails the operators (throttled); a misconfigured provider answers 503 and alerts. |

## Hardening checklist before launch

- [x] Fix S-1 (server-side verification gate for publishing)
- [ ] Set a random `JWT_SECRET` of 48+ bytes; never reuse across environments
- [ ] `NODE_ENV=production`, `TRUST_PROXY` set correctly for the host
- [ ] `CLIENT_ORIGIN` set to the exact production origin(s)
- [ ] Redis configured for shared rate-limit counters
- [ ] Real SMTP configured; boot check passes
- [ ] DB TLS on (`DB_SSL=true` + CA), `DB_RLS=true` on Supabase, backups tested
- [ ] Uploads: `STORAGE_DRIVER=supabase` with a public bucket restricted to image types and 4 MB (docs/DEPLOYMENT.md); do one real upload and delete to confirm the driver works
- [ ] `PAYMENTS_ENABLED=true` only with a real `PAYMENT_PROVIDER` and all of its credentials (the API refuses to boot otherwise)
- [ ] Frontend security headers/CSP in place
- [ ] `npm audit` clean (or accepted); Dependabot on
- [ ] Admin account created with a strong unique password
- [ ] Privacy policy and terms published (the platform stores personal data of young people)

## Data protection notes

The platform stores names, emails, phone numbers, CV links and application text, often for users aged 18-25. Treat this as personal data: collect the minimum, honour deletion requests (`onDelete: CASCADE` already removes dependent rows), and review Tanzania's Personal Data Protection Act obligations with a qualified adviser before launch. *This document is not legal advice.*
