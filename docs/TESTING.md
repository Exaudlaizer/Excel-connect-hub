# Testing Strategy

**Current state:** a test harness and CI exist (since 2026-11-05) and cover the areas ticked below; the rest is the backlog. Run them with:

```bash
cd backend
npm test                                   # unit tests only (no database needed)
TEST_DATABASE_URL=postgres://… npm test    # plus integration tests against a real Postgres (tables are TRUNCATED: use a throwaway DB)
```

Tests use Node's built-in runner (`node --test`) and Supertest; files live in `backend/tests/`. CI (`.github/workflows/ci.yml`) runs migrations twice on an empty Postgres, the test suite, `npm audit` (fails on high/critical for the backend), and for the frontend `tsc`, lint and build.

**Covered so far (48 tests):** env/payment guards, provider registry and driver interface, mock gateway disabled in production, plan entitlements, `requireVerified`, ad creation gate and Free-plan limit, registration (atomic, no admin, duplicates), login and suspended accounts, and billing end to end with the mock gateway: checkout refused while disabled, upgrade only after verify, replay is idempotent, amount and currency tampering refused, unknown reference, audience rules, provider-that-created-it verification, and webhook signature handling (bad, missing, unknown reference, misconfigured).
**Still to do:** the full authorization matrix, OTP and password-reset flows, moderation visibility, applications, uploads, pagination, and the real Selcom/ClickPesa drivers against their sandboxes.

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
