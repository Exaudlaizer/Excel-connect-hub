# API Reference

Base URL: `http://localhost:5000/api` (local). Responses are JSON. Errors look like `{ "message": "…" }` (validation errors may include field details).

**Auth:** `Authorization: Bearer <jwt>`. Legend: 🌐 public · 🔓 optional token (extra visibility for owners/admin) · 🔐 any signed-in user · role names = `authorize(...)`.

List endpoints accept `?page=` (1-based) and `?limit=` (default 20, max 100) and return `{ <items>, pagination }`.

Health (outside `/api`): `GET /health` is liveness (the process is up, cheap). `GET /health/ready` is readiness: `200 {"database":"up"}` or `503 {"database":"down"}`; point uptime monitors and the host's health check at this one. Every response carries `X-Request-Id` (a safe client-supplied id is echoed back); quote it when reporting a problem.

## Auth: `/auth`

| Method & path | Access | Purpose | Rate limit (per IP) |
|---|---|---|---|
| POST `/register` | 🌐 | Create account (`student`, `company`, `mentor`) | 100/h |
| POST `/login` | 🌐 | Returns `{ token, user }` | 10 failed/15 min |
| POST `/forgot-password` | 🌐 | Email a reset link | 5/h |
| POST `/reset-password` | 🌐 | Consume token, set password | 10/h |
| POST `/verification/request` | 🔐 | Send code (`purpose`: email/phone) | 60/h |
| POST `/verification/confirm` | 🔐 | Confirm 6-digit code | 30/15 min |
| POST `/verification/request-public` | 🌐 | Send email code by address | 60/h |
| POST `/verification/confirm-public` | 🌐 | Confirm email code | 30/15 min |
| GET `/me` | 🔐 | Current user | |
| POST `/logout-all` | 🔐 | Cancels every login on every device (including this one) | |

## Users: `/users`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/` | admin | List users (`?role=&status=&q=`) |
| PATCH `/me` | 🔐 | Update own profile, preferences |
| PATCH `/:id/status` | admin | Suspend / reactivate |
| PATCH `/:id/role` | admin | Change role |

## Jobs: `/jobs`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/` | 🔓 | Approved jobs (owners/admin see more) |
| GET `/mine` | company, admin | Own listings |
| POST `/` | company, admin | Create (starts `pending`) |
| PATCH `/:id` | company, admin | Update |
| DELETE `/:id` | company, admin | Delete |
| PATCH `/:id/approval` | admin | Approve / reject |

## Applications: `/applications`

| Method & path | Access | Purpose |
|---|---|---|
| POST `/` | student | Apply (one per job) |
| GET `/mine` | student | Own applications |
| GET `/applicants` | company, admin | Applicants for own jobs |
| PATCH `/:id/status` | company, admin | submitted, reviewing, shortlisted, rejected, hired |

## Ads: `/ads`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/` | 🔓 | Approved ads |
| GET `/mine` | 🔐 | Own ads |
| POST `/` | student, company, mentor, admin | Create (starts `pending`) |
| PATCH `/:id`, DELETE `/:id` | 🔐 (ownership in controller) | Update / delete |
| PATCH `/:id/approval` | admin | Approve / reject |

## Courses: `/courses`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/` | 🔓 | Approved courses |
| POST `/` | mentor, admin | Create (starts `pending`) |
| PATCH `/:id`, DELETE `/:id` | mentor, admin | Update / delete |
| POST `/:id/enroll` | student | Enrol |
| PATCH `/:id/approval` | admin | Approve / reject |

## Community: `/community`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/`, GET `/:id` | 🔓 | List / read thread |
| POST `/` | 🔐 | New post |
| POST `/:id/replies` | 🔐 | Reply |
| PATCH `/:id/pin` | admin | Pin / unpin |
| DELETE `/:id`, DELETE `/:id/replies/:replyId` | 🔐 (author or admin, in controller) | Delete |

## Services: `/services`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/` | 🔓 | Directory |
| POST `/`, PATCH `/:id`, DELETE `/:id` | admin | Manage |

## Uploads: `/uploads` (40/15 min/IP)

| Method & path | Access | Purpose |
|---|---|---|
| POST `/` | student, company, mentor, admin | Multipart field with one image ≤ 4 MB (jpeg/png/webp/gif/avif). Returns absolute URL |
| DELETE `/:filename` | admin | Remove file |

Files are served read-only at `/uploads/<name>` (7-day cache).

## Billing: `/billing`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/plans` | 🔐 | Plan catalogue + `paymentsEnabled` |
| GET `/subscription` | 🔐 | Own subscription |
| GET `/payments` | 🔐 | Own payment history |
| POST `/checkout` | 🔐 | Start checkout `{ planKey }` (refused while payments disabled; 20/15 min) |
| POST `/confirm` | 🔐 | Verify return `{ txRef }` |
| POST `/cancel` | 🔐 | Cancel at period end |
| POST `/webhook` | gateway signature (checked by the active provider's `verifyWebhook`) | Gateway callback; 401 on a bad signature, 503 if the provider is misconfigured |

## Admin: `/admin`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/analytics` | admin | Platform counts and queues |
| GET `/audit` | admin | Activity trail, newest first. Filters: `action`, `actorId`, `targetType`, `targetId`; paginated (default 50) |

## Behaviour notes

- **Sessions.** A login token lasts 24 h (`JWT_EXPIRES_IN`). When a request arrives with a token more than 12 h old, the response carries a fresh token in the `X-Renewed-Token` header and the client should store it. Tokens are cancelled by a password reset, suspension, role change or `POST /auth/logout-all` (a `401` follows). `POST /auth/login` is limited to 5 failures per 15 min per email address (`429`), on top of the per-IP limit.

- `GET/POST/PATCH /courses` responses never include the roster; each course has `enrolledCount` and `isEnrolled` (the caller's own state).
- `PATCH /jobs/:id`: an owner's content change returns an approved job to `pending`; `{ "status": "closed" }` does not. Admin edits are not re-queued.
- `POST /auth/verification/confirm-public`: every failure returns `400 { "message": "That code is not correct or has expired." }`. The signed-in `/auth/verification/confirm` keeps detailed messages.
- `PATCH /users/me`: changing `phone` resets `phoneVerified`.

## Email-verification gate

These routes additionally require a verified email (admins included) and otherwise return `403` with `{ "code": "EMAIL_NOT_VERIFIED", "message": … }`: POST/PATCH `/jobs`, POST/PATCH `/ads`, POST/PATCH `/courses`, POST `/community` and `/community/:id/replies`, POST `/uploads`.

## Status codes

`200/201` success · `400` validation failed · `401` missing/invalid token or suspended · `403` wrong role · `404` not found · `409` conflict (e.g. email exists, duplicate application) · `429` rate limited · `500` server error.

> Request/response field shapes are defined by the validators in `backend/src/routes/*` and models. An OpenAPI spec is a planned improvement (see PLAN.md).
