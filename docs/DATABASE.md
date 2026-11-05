# Database

PostgreSQL, accessed through Sequelize 6. Models: `backend/src/models/`. Associations: `backend/src/models/index.js`.

## Tables

`users`, `jobs`, `applications`, `ads`, `courses`, `services`, `community_posts`, `community_replies`, `otp_codes`, `password_reset_tokens`, `plans`, `subscriptions`, `payments`. Details of columns: [ARCHITECTURE_DESIGN.md §2](ARCHITECTURE_DESIGN.md).

Primary keys are UUIDs. Money is stored in **minor units** (`priceMinor` = TZS × 100); `ads.price` and `courses.price` are `DECIMAL(12,2)`.

## Relationships and delete behaviour

| Relationship | On user delete |
|---|---|
| user → jobs, ads, courses, applications | default (restrict / no cascade declared) |
| user → community posts & replies | CASCADE |
| user → otp codes, reset tokens, subscription, payments | CASCADE |
| user → services (`createdById`) | SET NULL |

## Setting up a database

```bash
createdb excel_connect_hub            # or the SQL below
cd backend
cp .env.example .env                  # set DATABASE_URL, JWT_SECRET
npm run db:migrate                    # idempotent schema + indexes
npm run seed:plans                    # plan catalogue from config/billing.js
npm run seed:admin -- --email=you@example.com --password='…' --name="Admin"
```

```sql
CREATE DATABASE excel_connect_hub;
```

## Migration approach

- `npm run db:migrate` runs idempotent SQL steps (safe to re-run; never drops data). It exists because earlier `sync({ alter: true })` runs created duplicate unique indexes on `users.email` and left foreign keys unindexed.
- `DB_SYNC_ALTER=true` enables `sequelize.sync({ alter: true })` at boot. **Local development only.**
- There is no migration history table. Before multiple environments exist, adopt a versioned tool (e.g. `umzug` / `sequelize-cli`) so each change is recorded once.

## Maintenance scripts

| Command | Purpose | Caution |
|---|---|---|
| `npm run seed:admin` | Create or promote an admin; resets that account's password | Re-running resets the password |
| `npm run seed:plans` | Upsert plans from code | Idempotent |
| `npm run uploads:prune` | Delete unreferenced upload files past the grace period | Run with care in production |
| `npm run db:reset` | Reset the database | **Destructive. Never run against production** |

## Backups

Use the managed provider's automated backups plus a periodic `pg_dump`. Test a restore before launch.

## Known data-model limits

- `courses.enrolledStudents` is a UUID array (no per-enrolment data, no FK integrity). Migrate to an `enrollments` table.
- Role profiles are JSONB: flexible, but not constrained or easily indexed.
- No audit table for admin actions.
