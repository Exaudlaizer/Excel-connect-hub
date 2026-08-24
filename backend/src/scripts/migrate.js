/**
 * Idempotent schema migration.
 *
 * The database was previously shaped by `sequelize.sync({ alter: true })`, which
 * is why `users` ended up with four identical unique indexes on `email` and why
 * not a single foreign key carries an index. Both are fixed here, along with the
 * columns and tables the platform now needs.
 *
 * Every statement is written to be safe to re-run, so this doubles as the setup
 * path for a fresh database and the upgrade path for an existing one. Nothing
 * here drops a column or a table: no existing data is destroyed.
 *
 * Usage: npm run db:migrate
 */

require("dotenv").config();

const { sequelize } = require("../config/db");

const steps = [];

function step(name, sql) {
  steps.push({ name, sql });
}

/* ---------------------------------------------------------------------------
   1. users — drop the duplicate email indexes
   ---------------------------------------------------------------------------
   Postgres happily keeps all four. Every INSERT and UPDATE of a user pays to
   maintain four B-trees that enforce exactly the same rule. One is kept.
   ------------------------------------------------------------------------- */
step(
  "users: drop duplicate unique email constraints",
  `DO $$
   DECLARE
     keeper text;
     dup    text;
   BEGIN
     -- Prefer the canonical name; otherwise keep whichever one exists.
     SELECT con.conname INTO keeper
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'users'
        AND con.contype = 'u'
        AND pg_get_constraintdef(con.oid) = 'UNIQUE (email)'
      ORDER BY (con.conname = 'users_email_key') DESC, con.conname
      LIMIT 1;

     IF keeper IS NULL THEN
       RETURN;
     END IF;

     FOR dup IN
       SELECT con.conname
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'users'
          AND con.contype = 'u'
          AND pg_get_constraintdef(con.oid) = 'UNIQUE (email)'
          AND con.conname <> keeper
     LOOP
       EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', dup);
       RAISE NOTICE 'dropped duplicate constraint %', dup;
     END LOOP;
   END $$;`
);

/* ---------------------------------------------------------------------------
   2. users — columns the platform now needs
   ------------------------------------------------------------------------- */
step(
  "users: add phone",
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(40);`
);

step(
  "users: add preferences",
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;`
);

/* ---------------------------------------------------------------------------
   3. ads — business identity fields
   ---------------------------------------------------------------------------
   An advertisement catalogue needs to say who is advertising. Without these the
   UI can only invent a business name, which is exactly what it must not do.
   ------------------------------------------------------------------------- */
step(
  "ads: add businessName",
  `ALTER TABLE ads ADD COLUMN IF NOT EXISTS "businessName" VARCHAR(255);`
);
step("ads: add logoUrl", `ALTER TABLE ads ADD COLUMN IF NOT EXISTS "logoUrl" VARCHAR(500);`);
step("ads: add linkUrl", `ALTER TABLE ads ADD COLUMN IF NOT EXISTS "linkUrl" VARCHAR(500);`);
step(
  "ads: widen imageUrl",
  `ALTER TABLE ads ALTER COLUMN "imageUrl" TYPE VARCHAR(500);`
);

/* ---------------------------------------------------------------------------
   4. community — student discussions and announcements
   ------------------------------------------------------------------------- */
step(
  "community_posts: enum type",
  `DO $$ BEGIN
     CREATE TYPE enum_community_posts_category AS ENUM ('discussion', 'question', 'announcement', 'group', 'event');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
);

step(
  "community_posts: table",
  `CREATE TABLE IF NOT EXISTS community_posts (
     id          UUID PRIMARY KEY,
     "authorId"  UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
     title       VARCHAR(180) NOT NULL,
     body        TEXT NOT NULL,
     category    enum_community_posts_category NOT NULL DEFAULT 'discussion',
     pinned      BOOLEAN NOT NULL DEFAULT FALSE,
     "createdAt" TIMESTAMPTZ NOT NULL,
     "updatedAt" TIMESTAMPTZ NOT NULL
   );`
);

step(
  "community_replies: table",
  `CREATE TABLE IF NOT EXISTS community_replies (
     id          UUID PRIMARY KEY,
     "postId"    UUID NOT NULL REFERENCES community_posts(id) ON UPDATE CASCADE ON DELETE CASCADE,
     "authorId"  UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
     body        TEXT NOT NULL,
     "createdAt" TIMESTAMPTZ NOT NULL,
     "updatedAt" TIMESTAMPTZ NOT NULL
   );`
);

/* ---------------------------------------------------------------------------
   5. services — the university / student support directory
   ---------------------------------------------------------------------------
   Curated by administrators. Students read it; nobody else writes to it.
   ------------------------------------------------------------------------- */
step(
  "services: enum types",
  `DO $$ BEGIN
     CREATE TYPE enum_services_category AS ENUM ('academic', 'career', 'wellbeing', 'financial', 'housing', 'technology', 'library', 'other');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN
     CREATE TYPE enum_services_status AS ENUM ('active', 'archived');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
);

step(
  "services: table",
  `CREATE TABLE IF NOT EXISTS services (
     id             UUID PRIMARY KEY,
     name           VARCHAR(180) NOT NULL,
     category       enum_services_category NOT NULL DEFAULT 'other',
     description    TEXT NOT NULL,
     provider       VARCHAR(180),
     location       VARCHAR(180),
     "contactEmail" VARCHAR(180),
     "contactPhone" VARCHAR(40),
     url            VARCHAR(500),
     status         enum_services_status NOT NULL DEFAULT 'active',
     "createdById"  UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
     "createdAt"    TIMESTAMPTZ NOT NULL,
     "updatedAt"    TIMESTAMPTZ NOT NULL
   );`
);

/* ---------------------------------------------------------------------------
   7. One-time verification codes
   ---------------------------------------------------------------------------
   Replaces the click-a-link flow with a 6-digit code the user types back. The
   code itself is never stored — only its SHA-256 hash — so a leaked database
   row cannot be used to verify somebody's address.

   `target` records which address or number the code was issued for. If a user
   edits their phone after requesting a code, the old code no longer matches the
   new target and is refused, so a code cannot be used to confirm a value the
   user never received it at.
   ------------------------------------------------------------------------- */
step(
  "otp_codes: enum type",
  `DO $$ BEGIN
     CREATE TYPE enum_otp_codes_purpose AS ENUM ('email', 'phone');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
);

step(
  "otp_codes: table",
  `CREATE TABLE IF NOT EXISTS otp_codes (
     id           UUID PRIMARY KEY,
     "userId"     UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
     purpose      enum_otp_codes_purpose NOT NULL,
     "codeHash"   VARCHAR(64) NOT NULL,
     target       VARCHAR(190) NOT NULL,
     "expiresAt"  TIMESTAMPTZ NOT NULL,
     "consumedAt" TIMESTAMPTZ,
     attempts     INTEGER NOT NULL DEFAULT 0,
     "createdAt"  TIMESTAMPTZ NOT NULL,
     "updatedAt"  TIMESTAMPTZ NOT NULL
   );`
);

step(
  "users: add phoneVerified",
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT FALSE;`
);

/* ---------------------------------------------------------------------------
   6. Indexes
   ---------------------------------------------------------------------------
   Every list endpoint filters on a foreign key, a status, or both, and every one
   of them was doing a sequential scan. These are the exact access paths the
   controllers use.
   ------------------------------------------------------------------------- */
const indexes = [
  ["users_role_idx", `users (role)`],
  ["users_status_idx", `users (status)`],
  ["jobs_company_id_idx", `jobs ("companyId")`],
  ["jobs_status_created_at_idx", `jobs (status, "createdAt" DESC)`],
  ["ads_owner_id_idx", `ads ("ownerId")`],
  ["ads_status_created_at_idx", `ads (status, "createdAt" DESC)`],
  ["ads_category_idx", `ads (category)`],
  ["courses_provider_id_idx", `courses ("providerId")`],
  ["courses_status_created_at_idx", `courses (status, "createdAt" DESC)`],
  ["applications_student_id_idx", `applications ("studentId")`],
  ["community_posts_author_id_idx", `community_posts ("authorId")`],
  ["community_posts_feed_idx", `community_posts (pinned DESC, "createdAt" DESC)`],
  ["community_posts_category_idx", `community_posts (category)`],
  ["community_replies_post_id_idx", `community_replies ("postId", "createdAt")`],
  ["community_replies_author_id_idx", `community_replies ("authorId")`],
  ["services_status_category_idx", `services (status, category)`],
  ["services_created_by_id_idx", `services ("createdById")`],
  // The lookup every verification attempt makes: newest live code for this
  // user and purpose.
  ["otp_codes_lookup_idx", `otp_codes ("userId", purpose, "consumedAt", "expiresAt" DESC)`],
  ["otp_codes_expires_idx", `otp_codes ("expiresAt")`]
];

indexes.forEach(([name, target]) => {
  step(`index: ${name}`, `CREATE INDEX IF NOT EXISTS ${name} ON ${target};`);
});

async function run() {
  await sequelize.authenticate();
  console.log("Connected. Applying migration...\n");

  for (const { name, sql } of steps) {
    await sequelize.query(sql);
    console.log(`  ok  ${name}`);
  }

  console.log("\nMigration complete.");
  await sequelize.close();
}

run().catch(async (error) => {
  console.error("\nMigration failed:", error.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
