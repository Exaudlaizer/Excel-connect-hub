# Plan

Delivery roadmap, ordered by risk reduction first, growth second. Dates are *proposed* relative weeks from kickoff; adjust to team size.

## Phase 0: Stabilise (week 1-2) ← start here

Goal: make what exists safe to run in front of real users.

- [x] Remove redundant backend shim folders; `server.js` points at `src/`
- [x] Fix invalid `vercel.json`
- [x] Boot guard: payments cannot be enabled with the mock driver
- [x] Patch dependency advisories that don't require breaking changes
- [x] Enforce email verification server-side for publishing (SECURITY S-1); tests still to write
- [x] Free-plan one-ad limit enforced (it was not); tests added
- [x] DB TLS option, pool size, opt-in Supabase RLS
- [x] CI: empty-DB migration x2, tests on Postgres 16, audit, tsc, lint, build
- [x] Fixed `db:migrate` on empty DBs and non-atomic registration (found by the new tests)
- [x] Commit-message convention (see CONTRIBUTING.md)
- [ ] Production env checklist run-through (needs real accounts, Week 0)

**Exit criteria:** CI green; S-1 closed; staging deployed.

## Phase 2 status (2026-11-05)

Done: authorization matrix over all routes, verification gate, OTP, password reset, moderation, courses/enrolment, applications, users, community, services, uploads, pagination: 224 tests, 91.6% line coverage. The tests found and fixed four real defects (SECURITY S-14 to S-17). Open: Vercel deployment red until the Root Directory setting is applied (docs/DEPLOYMENT.md).

## Phase 1: Test and deploy (week 3-4)

- [ ] Backend tests: auth, authorization matrix, approval flow, billing verify (Jest/Vitest + Supertest + throwaway Postgres)
- [ ] Frontend smoke tests (Playwright): signup, login, apply, admin approve
- [ ] Deploy API (Render/Fly/VPS) + managed Postgres + Redis; frontend on Vercel
- [ ] Real SMTP; error tracking; uptime monitor on `/health`
- [ ] Seed admin, seed plans, run `db:migrate`

**Exit criteria:** staging end-to-end passes; backup/restore tested.

## Phase 2: Launch readiness (week 5-6)

- [ ] Frontend security headers and CSP (S-3)
- [ ] Object storage for uploads (S-5)
- [ ] Privacy policy, terms, cookie/storage notice
- [ ] Moderation playbook and approval SLA
- [ ] Seed content: partner employers, 3-5 mentors, services directory
- [ ] Upgrade Next.js to a supported major (clears remaining advisories)

**Exit criteria:** pilot with one university.

## Phase 3: Growth (month 2-3)

- [ ] Email notifications (application status, approvals)
- [ ] `enrollments` table; course reviews
- [ ] Deadline auto-close; application withdrawal
- [ ] Search and filters upgrade (Postgres full-text)
- [ ] Swahili UI
- [ ] Admin audit log (S-8)

## Phase 4: Monetise (month 3-4)

- [ ] Write the Selcom or ClickPesa driver from its official docs, then flip `PAYMENTS_ENABLED` in staging with sandbox credentials
- [ ] Mobile-money checkout testing (M-Pesa, Tigo Pesa, Airtel Money)
- [ ] Implement paid-plan benefits that are only copy today: featured placement, priority review, analytics
- [ ] Renewals, receipts, failed-payment handling
- [ ] Go live with one paid plan first (suggest Employer Pro)

## Dependencies and risks

| Risk | Impact | Mitigation |
|---|---|---|
| No tests | Regressions during every phase | Phase 1 before new features |
| Single-person moderation | Approval queue becomes the bottleneck | Define SLA; add moderator role later |
| Next.js major upgrade | Possible breaking changes | Do it in its own branch after tests exist |
| Business registration and gateway KYC | Delays monetisation; free launch is the base case | Finish BRELA/TIN/licence and apply to Selcom and ClickPesa now |

## Definition of done (all work)

Builds cleanly, tests added or updated, docs touched if behaviour changed, `PROGRESS.md` and `CHANGELOG.md` updated, no new `npm audit` high/critical.
