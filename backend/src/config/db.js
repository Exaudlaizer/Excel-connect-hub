const { Sequelize } = require("sequelize");

const databaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/excel_connect_hub";

// Managed Postgres (Supabase, Render, RDS…) requires TLS. DB_SSL=true turns it
// on. Provide the provider's CA certificate in DB_SSL_CA (PEM text) to also
// verify the server; without it the connection is encrypted but the server
// identity is not checked, and a warning says so.
function sslOptions() {
  if (process.env.DB_SSL !== "true") return undefined;
  const ca = process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, "\n") : undefined;
  if (!ca) {
    console.warn("DB_SSL is on without DB_SSL_CA: traffic is encrypted but the database server is not verified.");
  }
  return { require: true, rejectUnauthorized: Boolean(ca), ...(ca ? { ca } : {}) };
}

const ssl = sslOptions();

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: ["production", "test"].includes(process.env.NODE_ENV) ? false : console.log,
  // Hosted poolers cap connections per project, so the pool is configurable
  // rather than left at a size that could exhaust the plan on a few instances.
  pool: { max: Number(process.env.DB_POOL_MAX) || 10, idle: 10000, acquire: 30000 },
  ...(ssl ? { dialectOptions: { ssl } } : {})
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
