# Architecture Design

Detailed design: data model, key flows, and the reasoning behind decisions. Companion to [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Design principles

1. **Safe by default, loose where the audience demands it.** Students share campus Wi-Fi, so per-IP limits are generous and the real protections are per-account.
2. **Free first, monetisable later.** Billing exists end-to-end but is gated by configuration, not code.
3. **Moderate before publish.** User-submitted jobs, ads and courses start `pending`.
4. **Fail fast on misconfiguration.** `assertEnv()` refuses to boot with a missing or placeholder `JWT_SECRET`.
5. **Idempotent operations.** `db:migrate` and `seed:plans` are safe to re-run.

## 2. Data model

```
User (users) ──┬─< Job (jobs) ──< Application (applications) >── User (student)
               ├─< Ad (ads)
               ├─< Course (courses)          enrolledStudents: UUID[]  (denormalised)
               ├─< CommunityPost ──< CommunityReply
               ├─< Service (services)        createdById SET NULL
               ├─< OtpCode                   (CASCADE)
               ├─< PasswordResetToken        (CASCADE)
               ├── Subscription (1:1)        planKey → Plan.key
               └─< Payment                   planKey → Plan.key
```

### Entities

| Entity | Key fields | Notes |
|---|---|---|
| **User** | id (UUID), name, email (unique), password (bcrypt cost 12), role, status, emailVerified, phone, phoneVerified, preferences (JSONB), studentProfile / companyProfile / mentorProfile (JSONB) | Role-specific profile kept as JSONB to avoid three sparse tables |
| **Job** | companyId, title, type (job/internship), location, workMode, description, requirements[], salaryRange, deadline, status (pending/approved/rejected/closed) | Default `pending` |
| **Application** | jobId, studentId, coverLetter, cvUrl, status (submitted/reviewing/shortlisted/rejected/hired) | Unique (jobId, studentId) prevents duplicate applications |
| **Ad** | ownerId, title, businessName, category, description, price, contact, imageUrl, logoUrl, linkUrl, location, status (pending/approved/rejected/expired) | Default `pending` |
| **Course** | providerId, title, category, description, duration, price, deliveryMode, startDate, status (pending/approved/rejected/archived), enrolledStudents[] | Default `pending` |
| **Service** | name, category, description, provider, contact*, url, status (active/archived), createdById | Admin-curated directory |
| **CommunityPost / Reply** | authorId, title, body, category, pinned | Cascade delete with author |
| **Plan** | key (unique), name, audience, priceMinor, currency, interval, features (JSONB), isActive, sortOrder | Seeded from `config/billing.js` |
| **Subscription** | userId (unique), planKey, status, provider, providerRef, period start/end, cancelAtPeriodEnd | Every account gets a `free` row at signup |
| **Payment** | userId, planKey, provider, txRef (unique), amountMinor, currency, status, meta | Money in minor units (TZS x 100) |
| **OtpCode / PasswordResetToken** | hashed secret, expiry, attempts, purpose | Reset tokens stored as SHA-256 |

Authoritative schema: `backend/src/models/*` and `backend/src/scripts/migrate.js`.

## 3. Key flows

### 3.1 Registration and verification
1. `POST /auth/register` (rate limit 100/h/IP): validates, rejects `admin`, hashes password, creates `User` and a `free` `Subscription`, issues JWT, sends an email code.
2. User enters the 6-digit code: `POST /auth/verification/confirm` (or the `-public` variant when not signed in).
3. Code rules: 60 s resend cooldown, one live code per purpose, burned after 5 wrong guesses.
4. `requireVerified` then blocks unverified users from publishing (jobs, ads, courses, posts, uploads); browsing, applying and enrolling are unaffected. Admins are exempt.

### 3.2 Login
`POST /auth/login` (10 failed attempts/15 min/IP; successes not counted) compares bcrypt, rejects suspended accounts, returns JWT. The frontend stores it in `localStorage` ("remember me") or `sessionStorage`.

### 3.3 Password reset
`forgot-password` (5/h/IP) emails a single-use link whose raw token is never stored (SHA-256 hash only, 60-minute expiry). `reset-password` (10/h/IP) consumes it.

### 3.4 Content moderation
Create (pending) → admin `PATCH /…/:id/approval` → approved (public) or rejected. Public listing endpoints return only approved items; owners and admins see their own pending items (`optionalProtect` widens visibility for staff/owners and treats suspended users as anonymous).

### 3.5 Apply to a job
Student `POST /applications` → unique (jobId, studentId) → company reviews via `GET /applications/applicants` and updates status via `PATCH /applications/:id/status`.

### 3.6 Subscription checkout (when enabled)
1. `POST /billing/checkout` (20/15 min/IP): refused with "coming soon" unless `PAYMENTS_ENABLED=true` and keys are set. Creates a pending `Payment` (unique `txRef`) and returns the gateway URL.
2. User pays at Flutterwave and returns to `/billing/return`.
3. `POST /billing/confirm` **verifies server-to-server** and only upgrades if amount **and** currency match the pending payment. The webhook (`verif-hash` header, timing-safe compare) takes the same verified path. Already-successful payments are idempotent.

### 3.7 Uploads
`POST /uploads` (40/15 min/IP), single image, 4 MB, MIME allow-list (jpeg/png/webp/gif/avif; **SVG excluded** because it can carry script). Filenames are random; extension comes from a fixed table, not from the client. `uploads:prune` removes unreferenced files past a grace period.

## 4. Cross-cutting design

| Concern | Design |
|---|---|
| Config | `.env` via dotenv; `assertEnv()` validates; `.env.example` documents every variable |
| Errors | `notFound` + `errorHandler` return `{ message }` JSON |
| Pagination | `?page=&limit=`, default 20, hard max 100, returns `pagination` meta |
| Rate limiting | `express-rate-limit`, named limiters, Redis store optional with graceful fallback |
| Logging | Morgan (`combined` in production, `dev` otherwise) |
| Shutdown | SIGINT/SIGTERM closes HTTP server, Postgres pool and Redis; 10 s hard stop |
| Schema | `db:migrate` idempotent SQL; `DB_SYNC_ALTER=true` is an opt-in dev convenience, not the production path |

## 5. Decision log

| # | Decision | Rationale | Trade-off |
|---|---|---|---|
| D1 | Monorepo with `frontend/` and `backend/` | One repo, independent deploys | Two `package.json`s |
| D2 | Express + Sequelize + Postgres | Familiar, relational fit | Sequelize ergonomics and typing weaker than newer ORMs |
| D3 | JWT bearer tokens | Simple, SPA-friendly | No revocation; XSS can steal a `localStorage` token |
| D4 | Role profiles as JSONB | Fast iteration | Weaker constraints; hard to query/index deeply |
| D5 | Plans in code, mirrored to DB | Reviewable, but editable at runtime | Two sources of truth to keep aligned |
| D6 | Mock payment driver when no keys | Whole flow testable offline | Must never run with `PAYMENTS_ENABLED=true` and no keys (guarded by `flutterwaveConfigured()`; see SECURITY.md S-6) |
| D7 | Local-disk uploads | Zero infrastructure at start | Not horizontally scalable; migrate to object storage |
| D8 | Backend source consolidated under `backend/src/` | Single source of truth | Removed the earlier one-line re-export shims at `backend/{controllers,models,routes,middleware,config}` |

## 6. Evolution path

1. Tests and CI (unit for controllers/utils, integration with a throwaway Postgres).
2. Server-side email-verification gate and token revocation.
3. Object storage for uploads; `enrollments` table.
4. TypeScript or JSDoc types for the API contract; generate an OpenAPI spec.
5. Observability: structured logs, error tracking, uptime checks.
