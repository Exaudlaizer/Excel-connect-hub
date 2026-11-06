// Shared setup for integration tests. They need a real Postgres database:
//   TEST_DATABASE_URL=postgres://… npm test
// Without it the integration suites are skipped and only unit tests run.
//
// The URL must be set BEFORE any app module loads, because config/db reads
// DATABASE_URL when it is first required — hence the assignments below.

process.env.NODE_ENV = "test";
// Uploads go to a throwaway directory, never the real backend/uploads folder.
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || require("path").join(require("os").tmpdir(), `ech-test-uploads-${process.pid}`);
// The app creates this directory when it loads, so every test process that loads
// it must remove it again, not only the uploads suite.
if (!process.env.UPLOAD_DIR_KEEP) {
  process.on("exit", () => require("fs").rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));
}
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-0123";
process.env.CLIENT_ORIGIN = "http://localhost:3000";
// Trust X-Forwarded-For so each test can present its own client address; the
// per-IP rate limits (e.g. 5 reset requests an hour) would otherwise be shared
// by every test in the process.
process.env.TRUST_PROXY = "1";

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

const jobPayload = (overrides = {}) => ({
  title: "Junior software developer",
  type: "job",
  location: "Dar es Salaam",
  description: "Build and maintain web applications for our growing student platform.",
  ...overrides
});

const coursePayload = (overrides = {}) => ({
  title: "Intro to Python",
  category: "technology",
  description: "A practical beginner course covering variables, loops and functions.",
  ...overrides
});

// Direct database factories, for setting up state without going through the API.
async function makeJob(owner, overrides = {}) {
  const { models } = load();
  return models.Job.create({ ...jobPayload(), companyId: owner.id, status: "approved", ...overrides });
}

async function makeCourse(provider, overrides = {}) {
  const { models } = load();
  return models.Course.create({ ...coursePayload(), providerId: provider.id, status: "approved", ...overrides });
}

async function makeAd(owner, overrides = {}) {
  const { models } = load();
  return models.Ad.create({ ...adPayload(), ownerId: owner.id, status: "approved", ...overrides });
}

// Runs fn while capturing everything written with console.log. With no SMTP
// configured the mailer prints each message there, so this is how a test gets
// the verification code or reset link a real user would receive by email.
async function captureMail(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(" "));
  try {
    const result = await fn();
    return { result, mail: lines.join("\n") };
  } finally {
    console.log = original;
  }
}

const extractCode = (mail) => (mail.match(/\b(\d{6})\b/) || [])[1];
const extractResetToken = (mail) => (mail.match(/reset-password\?token=([0-9a-f]{64})/) || [])[1];

let ipCounter = 0;
// A fresh, valid client address per call.
const nextIp = () => `10.${Math.floor(++ipCounter / 65000) % 250}.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;

// Polls until the condition is true (or the timeout passes) instead of sleeping a
// fixed time. A fixed sleep is too short on a loaded machine and wastes time on a
// fast one; waiting for the thing itself is neither. Returns whether it happened.
async function waitFor(predicate, { timeout = 3000, interval = 5 } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return Boolean(await predicate());
}

async function closeDb() {
  if (loaded) await loaded.sequelize.close();
}

module.exports = {
  hasDb,
  load,
  resetDb,
  seedPlans,
  makeUser,
  adPayload,
  jobPayload,
  coursePayload,
  makeJob,
  makeCourse,
  makeAd,
  captureMail,
  nextIp,
  waitFor,
  extractCode,
  extractResetToken,
  closeDb
};
