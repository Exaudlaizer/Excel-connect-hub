// Fail fast on misconfiguration. Without this, a missing JWT_SECRET surfaces as
// a generic 401 on every authenticated request (jwt.verify throws and the auth
// middleware swallows it), which is a miserable thing to debug.

const { DRIVERS, knownProviders, missingEnv, providerName } = require("../payments");
const { driverName, knownDrivers, missingSupabaseEnv } = require("../storage");

const WEAK_SECRETS = ["replace-with-a-long-random-secret", "secret", "changeme"];

function assertEnv() {
  const problems = [];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    problems.push("JWT_SECRET is not set. Copy .env.example to .env and set a long random value.");
  } else if (WEAK_SECRETS.includes(secret)) {
    problems.push("JWT_SECRET is still the placeholder value. Set a real random secret.");
  } else if (secret.length < 32 && process.env.NODE_ENV === "production") {
    problems.push("JWT_SECRET must be at least 32 characters in production.");
  }

  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    problems.push("DATABASE_URL must be set explicitly in production.");
  }

  // A typo in PAYMENT_PROVIDER must not silently fall back to anything.
  const provider = providerName();
  if (!DRIVERS[provider]) {
    problems.push(`PAYMENT_PROVIDER "${provider}" is not recognised. Available: ${knownProviders().join(", ")}.`);
  } else if (process.env.PAYMENTS_ENABLED === "true") {
    // The mock driver approves whatever amount it is asked about, so it would
    // hand out paid plans for free. It must never be reachable once real
    // payments are switched on.
    if (provider === "mock") {
      problems.push("PAYMENTS_ENABLED=true requires PAYMENT_PROVIDER to be a real gateway (the mock would grant paid plans for free).");
    } else {
      const missing = missingEnv(DRIVERS[provider]);
      if (missing.length) {
        problems.push(`PAYMENTS_ENABLED=true with PAYMENT_PROVIDER=${provider} requires: ${missing.join(", ")}.`);
      }
    }
  }

  // Where uploaded images go. Same rule as the payment provider: a typo must not
  // quietly fall back, and a chosen driver must be fully configured.
  const storage = driverName();
  if (!knownDrivers().includes(storage)) {
    problems.push(`STORAGE_DRIVER "${storage}" is not recognised. Available: ${knownDrivers().join(", ")}.`);
  } else if (storage === "supabase") {
    const missing = missingSupabaseEnv();
    if (missing.length) {
      problems.push(`STORAGE_DRIVER=supabase requires: ${missing.join(", ")}.`);
    } else {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
        problems.push("SUPABASE_URL must start with https:// in production.");
      }
      // A publishable/anon key is meant for browsers and cannot write to storage
      // without extra rules; using one here is a mistake worth catching at boot.
      if (/^sb_publishable_/.test(key)) {
        problems.push("SUPABASE_SECRET_KEY is a publishable key. Use the project's secret key (sb_secret_...), kept on the server only.");
      }
    }
  }

  if (problems.length) {
    throw new Error(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
  }
}

module.exports = { assertEnv };
