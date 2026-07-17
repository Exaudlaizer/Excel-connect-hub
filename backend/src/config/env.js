// Fail fast on misconfiguration. Without this, a missing JWT_SECRET surfaces as
// a generic 401 on every authenticated request (jwt.verify throws and the auth
// middleware swallows it), which is a miserable thing to debug.

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

  if (problems.length) {
    throw new Error(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
  }
}

module.exports = { assertEnv };
