# API Reference

Base URL: `http://localhost:5000/api` (local). Responses are JSON. Errors look like `{ "message": "…" }` (validation errors may include field details).

**Auth:** `Authorization: Bearer <jwt>`. Legend: 🌐 public · 🔓 optional token (extra visibility for owners/admin) · 🔐 any signed-in user · role names = `authorize(...)`.

List endpoints accept `?page=` (1-based) and `?limit=` (default 20, max 100) and return `{ <items>, pagination }`.

Health: `GET /health` (outside `/api`) returns `{ status: "ok" }`.

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
| POST `/webhook` | signature (`verif-hash`) | Flutterwave callback |

## Admin: `/admin`

| Method & path | Access | Purpose |
|---|---|---|
| GET `/analytics` | admin | Platform counts and queues |

## Email-verification gate

These routes additionally require a verified email (admins exempt) and otherwise return `403` with `{ "code": "EMAIL_NOT_VERIFIED", "message": … }`: POST/PATCH `/jobs`, POST/PATCH `/ads`, POST/PATCH `/courses`, POST `/community` and `/community/:id/replies`, POST `/uploads`.

## Status codes

`200/201` success · `400/422` validation · `401` missing/invalid token or suspended · `403` wrong role · `404` not found · `409` conflict (e.g. email exists, duplicate application) · `429` rate limited · `500` server error.

> Request/response field shapes are defined by the validators in `backend/src/routes/*` and models. An OpenAPI spec is a planned improvement (see PLAN.md).
