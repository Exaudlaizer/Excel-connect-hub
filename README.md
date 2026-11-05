# Excel Connect Hub

Production-ready starter platform for a Tanzanian student-business ecosystem connecting university students, companies, recruiters, SMEs, and training providers.

## Folder Structure

```txt
Excel-connect-hub/
├── backend/
│   ├── server.js          # process entry
│   ├── src/               # app, config, routes, controllers, models, middleware, utils, scripts
│   └── .env.example
├── frontend/              # Next.js 14 (App Router, TypeScript, Tailwind)
│   ├── app/  components/  lib/
│   └── .env.example
├── docs/                  # PRD, architecture, API, plan, progress, ...
├── AGENT.md  SECURITY.md  CONTRIBUTING.md  CHANGELOG.md
└── vercel.json            # frontend build config for Vercel
```

All backend code lives in `backend/src/`.

## Documentation

| Doc | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements, users, scope |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) / [ARCHITECTURE_DESIGN.md](docs/ARCHITECTURE_DESIGN.md) | System overview; data model, flows, decisions |
| [docs/API.md](docs/API.md) | Endpoint reference |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, migrations, scripts |
| [docs/FEATURES.md](docs/FEATURES.md) | What is built vs planned |
| [docs/PLAN.md](docs/PLAN.md) / [PROGRESS.md](docs/PROGRESS.md) | Roadmap and current status |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) / [TESTING.md](docs/TESTING.md) | Shipping and test strategy |
| [SECURITY.md](SECURITY.md) | Security posture and known gaps |
| [AGENT.md](AGENT.md) / [CONTRIBUTING.md](CONTRIBUTING.md) | Guide for AI agents and contributors |

## Features

- JWT authentication with register, login, and role selection.
- Role-based access for `student`, `company`, `mentor`, and `admin`. Admin accounts
  cannot be self-registered; they are provisioned with `npm run seed:admin`.
- Student, company and mentor profiles; CV URL management; image uploads.
- Community discussions and an admin-curated campus services directory.
- Subscription plans with Flutterwave billing (built, switched off until `PAYMENTS_ENABLED=true`).
- Email OTP verification; a verified email is required to publish content.
- Company opportunity posting and applicant review APIs.
- Job and internship listings with student applications.
- Marketplace advertisements by category.
- Learning hub where independent mentors publish their own courses and youth enroll.
  The platform hosts mentors' courses; it does not author them.
- Password recovery by emailed reset link (hashed, single-use, 60-minute expiry).
- Admin analytics plus approval queues for jobs, ads, and courses.
- Secure Express defaults: Helmet, CORS, rate limiting, bcrypt password hashing, request validation.
- PostgreSQL database with Sequelize models and associations.
- Modern responsive Next.js dashboard UI with React Query.

## Backend Setup

Create the PostgreSQL database first:

```sql
CREATE DATABASE excel_connect_hub;
```

Then run the backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Edit `.env`:

```env
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/excel_connect_hub
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000
```

Create the schema with the idempotent migration, then seed plans:

```bash
npm run db:migrate
npm run seed:plans
```

`DB_SYNC_ALTER=true` makes Sequelize run `sync({ alter: true })` at boot. Use it for local schema experiments only.

### Create the first admin

`POST /auth/register` only accepts the `student` and `company` roles, so the first
administrator is created from the command line:

```bash
cd backend
npm run seed:admin -- --email=admin@example.com --password=change-me-8-chars --name="Site Admin"
```

After creating the admin, sign in and confirm the email address from Settings. Admins must verify like any other user before they can publish, and that confirmed address is where the platform will reach its operators.

Re-running the command against an existing email promotes that account to admin and
resets its password, which is also the way to recover a locked-out admin.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Open `http://localhost:3000`.

## REST API

Base URL: `http://localhost:5000/api`. The full endpoint list (about 56 routes across auth, users, jobs, applications, ads, courses, community, services, uploads, billing, admin) is in [docs/API.md](docs/API.md).

Protected routes require:

```txt
Authorization: Bearer <jwt-token>
```

## Recommended First Run

1. Start PostgreSQL locally.
2. Create the `excel_connect_hub` database.
3. Start the backend on port `5000`.
4. Start the frontend on port `3000`.
5. Create the admin account with `npm run seed:admin` (see above).
6. Register company and student accounts.
7. Use the company account to post jobs and courses.
8. Use the admin account to approve pending content.
9. Use the student account to apply and enroll.
