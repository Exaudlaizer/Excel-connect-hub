# Progress

Living status report. Update at the end of each work session.
**Last updated:** 2026-11-05

## Snapshot

| Area | Status | Comment |
|---|---|---|
| Backend API | 🟢 Feature-complete for v1 scope | 56 routes verified to load |
| Frontend | 🟢 Builds | 19 pages; `next build` passes on 14.2.35 |
| Database / migrations | 🟡 | Idempotent `db:migrate` exists; no migration history tool |
| Billing | 🟡 | Built but intentionally disabled; paid-plan benefits not implemented |
| Tests | 🔴 | None |
| CI/CD | 🔴 | None |
| Documentation | 🟢 | This doc set |
| Security | 🟡 | No High findings open; see SECURITY.md |
| Deployment | 🟡 | Config for Vercel frontend; API host undecided |

## Completed this session (2026-11-05)

- Reviewed the whole repo and produced the documentation set (PRD, architecture, design, security, features, plan, API, database, deployment, testing, agent guide, contributing, changelog).
- **Fixed** `vercel.json` (was a text diagram, not JSON) with a valid Next.js monorepo config; JSON validated. *Not yet deployed to Vercel.*
- **Removed** 33 one-line re-export shims under `backend/{controllers,models,routes,middleware,config,app.js}`; `server.js` now requires `src/` directly. Verified the app loads and registers all 56 routes. *Not tested against a live database.*
- **Security:** blocked the "payments enabled with mock driver" hole in `config/env.js` (tested three configurations); upgraded nodemailer 9 to 10.3.1; ran `npm audit fix` (backend 9 to 4 advisories); patched Next 14.2.23 to 14.2.35 and confirmed `next build`.
- Corrected my earlier mistake: the root-level backend folders were thin shims, not duplicated logic.

- **Email-verification gate (S-1):** `requireVerified` on 9 publish routes. Middleware unit-checked (unverified 403, verified and admin pass) and route wiring confirmed; *not exercised against a live database or UI*.

- **Production-plan Phase 1 (2026-11-05):** CI workflow, test harness (25 tests: 11 unit, 14 integration against a real Postgres 16 started locally), plan entitlements and Free-plan ad limit, DB TLS/pool options, opt-in RLS, mock-gateway production lock. Tests also exposed two real bugs, now fixed: `db:migrate` failed on an empty DB, and registration could orphan a user.

- **Payment provider layer (2026-11-05):** Flutterwave is unavailable to this project in Tanzania, so gateways are now drivers behind one interface (`backend/src/payments`). Mock and Flutterwave drivers implemented; Selcom and ClickPesa are **not yet written** (waiting on business registration, gateway approval and their official API docs). 48 tests pass (20 without a database); the amount-tamper test was confirmed to fail when the check is removed. Migration verified on fresh and legacy-shaped databases.

- **Phase 2 tests (2026-11-05):** 224 tests (22 need no DB), 91.6% line / 75.9% branch coverage of `backend/src`. Mutation-checked the permissions matrix, the moderation filter, the roster fix and the payment amount check. Defects found and fixed: student-ID leak in the public course list (S-14), job moderation bypass (S-15), account enumeration plus attempts-left off-by-one in public email verification (S-16), phone confirmation surviving a number change (S-17).
- **Vercel:** the deployment on PR #1 was red on the earlier heads and is **green on `bfff8eb`** (after the config moved to `frontend/vercel.json`). The original cause was never confirmed (no access to the Vercel log), and it is not known whether the config move or a project setting you changed fixed it. Root Directory = `frontend` is still the documented setup.

## Known behaviours left as they are
- `GET /applications/applicants` lists applicants for the caller's own jobs only, so an admin sees an empty list. Looks unintended for a moderation view but was not changed without your decision.
- Uploads trust the client-declared MIME type (no magic-byte check); S-5 remains open until uploads move to object storage.

- **Phase 4 so far (2026-11-06):** 4.1 revocable and renewing logins plus per-account login throttle; 4.2 audit log, operator alerts, monitoring, readiness, error screens, and a fix for stack traces reaching clients (S-18); 4.3 content-based image checks and pluggable storage with a Supabase driver written from the official docs. 334 backend tests. 4.4 frontend security headers and CSP, verified in a real browser (28 pages and admin tabs, with a negative control; the check caught that the first policy would have blocked Google Fonts). Token renewal across origins and 'Sign out on all devices' verified in the browser. 4.5 wrap-up done: SECURITY, TESTING, AGENT and PLAN updated. 334 backend tests (65 without a database), 93.98% line / 81.74% branch coverage.
- **Environment change:** to read Supabase's docs, a personal Claude environment named `excel-connect-hub` was created (with your approval) allowing `supabase.com` and `supabase.github.io`, and this session was moved onto it. Your Default environment was not changed. You can delete that environment in settings if you no longer want those hosts allowed.

## Not verified

- Never ran the API against Postgres or exercised any endpoint (no DB in this environment).
- Never ran the frontend in a browser.
- Email sending only tested through nodemailer's JSON transport, not real SMTP.
- README/docs claims about per-route permissions beyond jobs/admin/users were inferred; see ARCHITECTURE.md note.

## Known issues

| ID | Issue | Severity |
|---|---|---|
| S-9 | Remaining dependency advisories (backend 4 moderate; frontend 3 high + 1 critical, need Next 15/16) | Medium to High |
| S-2/S-3 | Token in localStorage; no frontend CSP | Medium |
| - | Free-plan ad limit not confirmed enforced | Low |
| - | `README.md` previously out of date (updated) | Fixed |
| - | Commit history uninformative | Process |

## Next up

1. CI pipeline with build + audit
2. Backend test suite for auth/authorization/billing (include the `requireVerified` gate)
3. Decide and set up the API host and database

## Changelog of this file

- 2026-11-05: created.
