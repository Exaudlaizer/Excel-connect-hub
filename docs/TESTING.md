# Testing Strategy

**Current state:** a test harness and CI exist (since 2026-11-05) and cover the areas ticked below; the rest is the backlog. Run them with:

```bash
cd backend
npm test                                   # unit tests only (no database needed)
TEST_DATABASE_URL=postgres://… npm test    # plus integration tests against a real Postgres (tables are TRUNCATED: use a throwaway DB)
```

Tests use Node's built-in runner (`node --test`) and Supertest; files live in `backend/tests/`. CI (`.github/workflows/ci.yml`) runs migrations twice on an empty Postgres, the test suite, `npm audit` (fails on high/critical for the backend), and for the frontend `tsc`, lint and build.

**Covered (334 tests, 65 of which need no database).** Measured with `node --test --experimental-test-coverage` against `src/` on 2026-11-06: **93.98% lines and 81.74% branches** overall; every controller is at or above 88% line coverage. Weakest remaining areas: `config/rateLimit.js` (the Redis store path), `utils/mailer.js` (real SMTP), `payments/flutterwave.js` (live HTTP calls), `config/db.js` (the SSL branch), and the Supabase driver against a real project (it is tested against a stand-in for Supabase's server that checks it sends what the documentation says). Those need external services and are exercised manually or in staging.

| Suite | What it proves |
|---|---|
| `authz.test.js` | Table-driven matrix over all 56 routes x anonymous/student/company/mentor/admin/suspended. Fails if any registered route is missing from the spec or any spec entry matches no route |
| `verification-gate.test.js` | The 9 publish routes block unverified users of every role, including admins; browsing, applying, enrolling, moderation and verification stay open |
| `otp.test.js` | Code emailed and stored hashed, 60 s cooldown, one live code, 5-guess burn, expiry, format, cross-account, public variants indistinguishable for known and unknown addresses |
| `password-reset.test.js` | Token hashed, single use, expiry, newer link retires older, identical answers for known/unknown/suspended, per-IP rate limit, suspended after request |
| `moderation.test.js` | For jobs, ads and courses: starts pending, hidden from public and rivals, visible to owner and admin, only admin approves, edits return to review, others cannot edit, suspended owner treated as anonymous |
| `courses.test.js`, `applications.test.js` | Enrolment rules and concurrency; roster never exposed; duplicate application 409; applicant visibility; status changes by owner/admin only |
| `users.test.js`, `community.test.js`, `services.test.js` | Self-service cannot change role/status/email/password/verification; no password hash in any response; admin cannot change own role/status; community and service permissions |
| `uploads.test.js` | Generated filenames, SVG/HTML/exe/PDF refused, 4 MB cap, nothing written on refusal, admin-only delete; runs in a temp directory |
| `sessions.test.js` | Logins carry a token version and last 24 h; password reset, suspension and reinstatement, role change and sign-out-everywhere each cancel existing logins; tokens older than 12 h are renewed (and never revoked or expired ones); the renewal header is readable by browsers; the per-account throttle treats known and unknown emails identically, ignores capitalisation and successes |
| `audit.test.js`, `alerts.test.js`, `monitoring.test.js` | Every audited action writes the right row and never stores secrets; a failed audit write never fails the action; operator alerts go to the right people, once per 15 minutes, with no secrets, and abandoned payments do not alert; stack traces reach clients only for development/test; the error reporter scrubs requests; request ids; readiness 200/503; the crash handler logs, alerts, flushes and exits 1 even if the alert hangs |
| `imageSignature.test.js`, `storage.test.js`, `uploads-storage.test.js` | Images are identified by content (a script labelled `image/png`, or an image whose label disagrees with its bytes, is refused; extension comes from the detected type); the Supabase driver sends what the documentation describes (URL, raw body, secret-key headers, no overwrite) and fails safely; cleanup removes each image from whichever store holds it; a half-configured driver fails at boot |
| `billing.test.js`, `unit.test.js`, `pagination.test.js`, `ads.test.js`, `auth.test.js` | Payment flow and tampering, boot guards, provider registry, plan limits, registration atomicity, pagination clamps |

**Browser checks (manual, not in CI because they need a Chromium download):** with the API and a production build of the site running, `cd frontend && CHECK_SITE=http://localhost:3000 CHECK_API=http://localhost:5000/api CHECK_ADMIN_EMAIL=... CHECK_ADMIN_PASSWORD=... node scripts/check-csp.mjs` loads public pages, a real login, signed-in pages and every admin tab, and fails on any CSP violation, failed request, uncaught error or missing security header. It includes a negative control (a script, a connection and a frame to a foreign origin must all be blocked). Run it after changing `frontend/next.config.mjs`, after adding a new third-party resource (fonts, analytics, images), and against the preview URL after a deploy. Also verified once by hand in the browser: token renewal across the two origins and the "Sign out on all devices" button.

**Mutation checks done:** removing the admin rule on `GET /users` fails the matrix; removing the "approved only" filter fails 4 moderation tests; putting the roster back fails the course test; removing the amount check fails the billing test. Each was restored afterwards.

**Timing:** tests wait for the thing they are testing (`waitFor` in `tests/helpers.js`), not a fixed number of milliseconds. One run of the no-database suite failed once and could not be reproduced in 8 further runs under heavy CPU load, so the cause is unknown; the fixed waits in my own tests were the only timing-sensitive pattern found and were replaced. If a test is flaky again, find out why before re-running.

**Still to do:** the real Selcom/ClickPesa drivers against their sandboxes, rate-limit behaviour with Redis, real SMTP, frontend end-to-end (Playwright), and a load check.

## Priorities (highest risk first)

1. **Authorization matrix**: for every route, anonymous/student/company/mentor/admin/suspended get the expected 200/401/403. This is the app's biggest risk surface.
2. **Auth flows**: register (admin rejected), login (suspended rejected, generic error), reset-token single use and expiry, OTP cooldown and 5-guess burn.
3. **Moderation**: new job/ad/course is `pending`, hidden from public lists, visible to owner/admin; approval flips visibility.
4. **Applications**: duplicate application returns 409; only the owning company sees applicants.
5. **Billing**: checkout refused when disabled; amount/currency mismatch does not upgrade; replayed `confirm` is idempotent; webhook with bad signature rejected; app refuses to boot with payments enabled and missing keys.
6. **Uploads**: SVG/non-image rejected, >4 MB rejected, filename not client-controlled.
7. **Pagination**: `limit` clamped to 100.

## Recommended tooling

| Layer | Tool |
|---|---|
| Backend unit and integration | Vitest or Jest + Supertest |
| Database | Throwaway Postgres (Docker service in CI), run `db:migrate` before tests |
| Frontend e2e | Playwright (signup, login, apply, admin approve) |
| Static | ESLint (`next lint`), `npm audit --omit=dev` |

## CI pipeline (proposed, GitHub Actions)

```
on: pull_request, push to main
jobs:
  backend:  npm ci → start postgres service → db:migrate → tests → npm audit --omit=dev (fail on high/critical)
  frontend: npm ci → next lint → next build
  e2e:      (nightly or on main) Playwright against a booted stack
```

## Manual smoke test (until automated)

1. Start Postgres; `npm run db:migrate`, `seed:plans`, `seed:admin`.
2. Start API (`npm run dev`) and frontend (`npm run dev`).
3. Register a company and a student; verify emails (codes print to the API console without SMTP).
4. Company posts a job → admin approves → student sees it and applies → company moves the applicant to shortlisted.
5. Mentor posts a course → admin approves → student enrols.
6. Suspend the student as admin; confirm their token stops working.
7. Billing: `GET /billing/plans`; `POST /billing/checkout` should respond "coming soon".

## Coverage goals

Authorization and billing paths: 100% of routes exercised. Overall target 70% lines on `backend/src/controllers` and `utils` by end of Phase 1 (PLAN.md).
