// Shared setup for integration tests. They need a real Postgres database:
//   TEST_DATABASE_URL=postgres://… npm test
// Without it the integration suites are skipped and only unit tests run.
//
// The URL must be set BEFORE any app module loads, because config/db reads
// DATABASE_URL when it is first required — hence the assignments below.

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-0123";
process.env.CLIENT_ORIGIN = "http://localhost:3000";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
if (hasDb) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

let loaded;

// Lazily loaded so unit-only runs never open a database connection.
function load() {
  if (loaded) return loaded;
  const request = require("supertest");
  const { sequelize } = require("../src/config/db");
  const app = require("../src/app");
  const models = require("../src/models");
  const { signToken } = require("../src/utils/tokens");
  loaded = { request, sequelize, app, models, signToken };
  return loaded;
}

async function resetDb() {
  const { sequelize } = load();
  require("../src/models");
  await sequelize.sync();
  const tables = (await sequelize.query("SELECT tablename FROM pg_tables WHERE schemaname='public'", { type: "SELECT" })).map(
    (row) => `"${row.tablename}"`
  );
  if (tables.length) await sequelize.query(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  await seedPlans();
}

// Accounts reference plans by key, so signup needs the catalogue to exist.
async function seedPlans() {
  const { models } = load();
  const { PLANS } = require("../src/config/billing");
  await models.Plan.bulkCreate(PLANS);
}

let counter = 0;

// Creates a user (with the Free subscription every real signup gets) and a
// bearer header for them.
async function makeUser({ role = "student", emailVerified = true, status = "active", plan } = {}) {
  const { models, signToken } = load();
  counter += 1;
  const user = await models.User.create({
    name: `Test ${role} ${counter}`,
    email: `${role}${counter}@example.com`,
    password: "password-123",
    role,
    status,
    emailVerified
  });
  await models.Subscription.create({
    userId: user.id,
    planKey: plan || "free",
    status: "active",
    provider: plan ? "manual" : "none"
  });
  return { user, auth: { Authorization: `Bearer ${signToken(user)}` } };
}

const adPayload = (overrides = {}) => ({
  title: "Fresh coffee on campus",
  category: "food",
  description: "Student-friendly coffee and snacks near the main gate.",
  contact: "+255700000000",
  ...overrides
});

async function closeDb() {
  if (loaded) await loaded.sequelize.close();
}

module.exports = { hasDb, load, resetDb, seedPlans, makeUser, adPayload, closeDb };
