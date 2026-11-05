# Architecture

A concise map of how Excel Connect Hub is put together. For the reasoning, data model and flows, see [ARCHITECTURE_DESIGN.md](ARCHITECTURE_DESIGN.md).

## 1. System context

```
 ┌───────────────┐      HTTPS       ┌────────────────────┐
 │  Browser      │ ───────────────► │  Next.js frontend  │  (Vercel)
 │ (student,     │                  │  App Router, React │
 │  company,     │                  │  Query, Tailwind   │
 │  mentor,      │                  └─────────┬──────────┘
 │  admin)       │                            │ REST/JSON + Bearer JWT
 └───────────────┘                            ▼
                                    ┌────────────────────┐
                                    │  Express API       │  (Node host:
                                    │  /api/*            │   Render/Fly/VM)
                                    └──┬─────┬─────┬─────┘
                       Sequelize ORM   │     │     │
                                       ▼     ▼     ▼
                              PostgreSQL   Redis   SMTP        Flutterwave
                              (data)    (rate-limit (email)    (payments)
                                         counters,
                                         optional)
                              Local disk: /uploads (images)
```

## 2. Repository layout

```
Excel-connect-hub/
├── frontend/              Next.js 14 app (TypeScript, Tailwind)
│   ├── app/               Routes (one folder per page)
│   ├── components/        Shell, auth, admin and shared UI
│   └── lib/               api.ts (fetch client), auth.tsx (session)
├── backend/
│   ├── server.js          Process entry: DB connect, rate-limit store, SMTP check, listen, graceful shutdown
│   └── src/
│       ├── app.js         Express app: middleware, limiters, routes
│       ├── config/        db, env validation, billing catalogue, rate limiting
│       ├── routes/        Route tables + validation rules
│       ├── controllers/   Request handlers / business logic
│       ├── models/        Sequelize models + associations (index.js)
│       ├── middleware/    auth (protect/optionalProtect/authorize), validate, errors
│       ├── utils/         flutterwave, mailer, pagination, tokens
│       └── scripts/       createAdmin, migrate, seedPlans, resetDatabase, pruneUploads
├── docs/                  Product and engineering documents
└── vercel.json            Frontend build config for Vercel
```

## 3. Components

| Component | Responsibility | Tech |
|---|---|---|
| Frontend | UI, client-side routing, session handling, data fetching/caching | Next.js 14, React 18, TanStack Query, Tailwind, lucide-react |
| API | Auth, authorisation, validation, business rules, billing, uploads | Express 4, express-validator, Helmet, CORS, Morgan |
| Database | System of record | PostgreSQL via Sequelize 6 |
| Rate-limit store | Shared counters across API instances | Redis (optional; falls back to in-process) |
| Mailer | Verification codes, password resets | Nodemailer (console fallback when SMTP unset) |
| Payments | Subscription checkout | Flutterwave (mock driver when keys unset) |
| File storage | Uploaded images | Local disk `backend/uploads/` served at `/uploads` |

## 4. Request lifecycle

1. Browser calls `NEXT_PUBLIC_API_URL` (`…/api`) with `Authorization: Bearer <jwt>`.
2. Express: Helmet, CORS (allow-list), body parsers (1 MB), Morgan, global rate limiter, then a route-specific limiter where one applies.
3. Route: express-validator rules, then `validate` returns 422/400 on failure.
4. `protect` verifies the JWT and loads the user (and subscription); `suspended` users are rejected. `authorize(...roles)` enforces role.
5. Controller runs business logic through Sequelize models.
6. `notFound` and `errorHandler` produce a uniform JSON error.

## 5. Roles and access

| Capability | Anonymous | Student | Company | Mentor | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Browse approved jobs/ads/courses/services | ✓ | ✓ | ✓ | ✓ | ✓ |
| Apply to a job | | ✓ | | | |
| Post/manage jobs | | | ✓ | | ✓ |
| Post ads (any signed-in role; edit/delete checked in controller) | | ✓ | ✓ | ✓ | ✓ |
| Create/manage courses | | | | ✓ | ✓ |
| Upload images | | ✓ | ✓ | ✓ | ✓ (delete: admin only) |
| Enrol in a course | | ✓ | | | |
| Community posts/replies | | ✓ | ✓ | ✓ | ✓ |
| Approve content, manage users/services | | | | | ✓ |

> Derived from the `authorize(...)` calls in `backend/src/routes/*`. Ownership checks for editing/deleting ads and community content live in the controllers (not re-verified line by line).

## 6. Deployment topology

- **Frontend:** Vercel, built from `frontend/` using the root `vercel.json`.
- **API:** any long-running Node host. **It cannot run on Vercel serverless as-is**: it keeps a persistent DB pool, serves files from local disk and expects a long-lived process.
- **Database:** managed PostgreSQL.
- **Redis:** managed instance recommended once there is more than one API instance.

See [DEPLOYMENT.md](DEPLOYMENT.md).

## 7. Known architectural limits

- Uploads on local disk do not survive container rebuilds and are not shared across instances. Move to S3-compatible storage before scaling out.
- `Course.enrolledStudents` is a UUID array on the course row. It is simple but does not scale to large enrolment counts or per-enrolment metadata; it should become an `enrollments` table.
- JWTs are stateless: there is no server-side revocation list, so a stolen token is valid until expiry (`JWT_EXPIRES_IN`, default 7d).
- No automated tests yet.
