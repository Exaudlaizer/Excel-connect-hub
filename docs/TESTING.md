# Testing Strategy

**Current state: there are no automated tests and no CI.** This document defines what to build first. Verification done so far was manual: the API module loads with 56 routes, `next build` succeeds, and the env guard was exercised in three configurations.

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
