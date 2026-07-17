# Excel Connect Hub

Production-ready starter platform for a Tanzanian student-business ecosystem connecting university students, companies, recruiters, SMEs, and training providers.

## Folder Structure

```txt
Excel-connect-hub/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── src/
│   ├── .env.example
│   ├── app.js
│   ├── package.json
│   └── server.js
└── frontend/
    ├── app/
    ├── components/
    ├── lib/
    ├── .env.example
    ├── package.json
    ├── tailwind.config.ts
    └── tsconfig.json
```

The required backend folders are present at `backend/config`, `backend/models`, `backend/routes`, `backend/controllers`, and `backend/middleware`.

## Features

- JWT authentication with register, login, and role selection.
- Role-based access for `student`, `company`, `mentor`, and `admin`. Admin accounts
  cannot be self-registered; they are provisioned with `npm run seed:admin`.
- Student profile and CV URL management.
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

In development, Sequelize runs `sync({ alter: true })` when the API starts. For production, use explicit migrations before deployment.

### Create the first admin

`POST /auth/register` only accepts the `student` and `company` roles, so the first
administrator is created from the command line:

```bash
cd backend
npm run seed:admin -- --email=admin@example.com --password=change-me-8-chars --name="Site Admin"
```

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

Base URL: `http://localhost:5000/api`

- `POST /auth/register` (roles: `student`, `company`, `mentor`)
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `GET /users` (supports `?role=`, `?status=`, `?q=`)
- `PATCH /users/me`
- `PATCH /users/:id/status`
- `GET /jobs`
- `GET /jobs/mine`
- `POST /jobs`
- `PATCH /jobs/:id`
- `PATCH /jobs/:id/approval`
- `POST /applications`
- `GET /applications/mine`
- `GET /applications/applicants`
- `PATCH /applications/:id/status`
- `GET /ads`
- `POST /ads`
- `PATCH /ads/:id/approval`
- `GET /courses`
- `POST /courses`
- `POST /courses/:id/enroll`
- `PATCH /courses/:id/approval`
- `GET /admin/analytics`

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
