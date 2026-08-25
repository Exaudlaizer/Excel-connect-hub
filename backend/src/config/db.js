const { Sequelize } = require("sequelize");

const rawDatabaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/excel_connect_hub";

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(rawDatabaseUrl);

// Every managed Postgres (Render, Neon, Supabase, Railway) refuses plaintext
// connections, and Sequelize does not infer TLS from the connection string.
// Without this the deployed API fails with "no encryption" / "SSL required".
const useSsl = process.env.DATABASE_SSL === "true" || (!isLocal && process.env.DATABASE_SSL !== "false");

// Sequelize hands the connection string to pg-connection-string and lets the
// parsed result *replace* dialectOptions, so an `sslmode=` in the URL silently
// discards the ssl block below — and pg is about to reinterpret that parameter
// with libpq semantics. The ssl-related parameters are dropped here so the TLS
// policy is stated in exactly one place; every other parameter the provider put
// in the query string is preserved.
function stripSslParams(url) {
  try {
    const parsed = new URL(url);
    ["sslmode", "ssl"].forEach((key) => parsed.searchParams.delete(key));
    return parsed.toString();
  } catch {
    return url;
  }
}

const sequelize = new Sequelize(stripSslParams(rawDatabaseUrl), {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "production" ? false : console.log,
  // `rejectUnauthorized: false` because several managed providers terminate TLS
  // with a chain Node's bundled roots do not recognise. The connection is still
  // encrypted; set DATABASE_SSL_STRICT=true once you have confirmed your
  // provider presents a publicly trusted certificate.
  dialectOptions: useSsl
    ? { ssl: { require: true, rejectUnauthorized: process.env.DATABASE_SSL_STRICT === "true" } }
    : {},
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 10,
    min: 0,
    idle: 10000,
    acquire: 30000
  }
});

async function connectDB() {
  await sequelize.authenticate();
  // Schema alteration is intentionally opt-in. Running `alter` on every dev
  // boot can take minutes against an existing database, leaving the API port
  // closed and making the frontend report a network/auth failure. Use
  // DB_SYNC_ALTER=true only when changing model schema locally.
  if (process.env.DB_SYNC_ALTER === "true") await sequelize.sync({ alter: true });
  console.log("PostgreSQL connected");
}

module.exports = { sequelize, connectDB };
