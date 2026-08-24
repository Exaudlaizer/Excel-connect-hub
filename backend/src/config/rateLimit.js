const rateLimit = require("express-rate-limit");

/**
 * Rate-limit storage.
 *
 * The default store keeps its counters in the process. That has two problems in
 * production: a restart wipes every counter, and behind more than one instance
 * an attacker gets the full budget from each one. Setting REDIS_URL moves the
 * counters to Redis, where every instance shares them and a restart changes
 * nothing.
 *
 * Redis is optional. Without it, or if it cannot be reached at boot, the
 * limiters fall back to the in-process store — degraded but still enforcing,
 * which is better than a server that refuses to start.
 */

let store;
let client;
let backend = "memory";

async function initRateLimitStore() {
  const url = process.env.REDIS_URL;

  if (!url) {
    console.log("Rate limiting: in-process store (set REDIS_URL to share counters across instances).");
    return { backend };
  }

  try {
    const { createClient } = require("redis");
    const { default: RedisStore } = require("rate-limit-redis");

    client = createClient({ url });

    // Without a handler, a dropped connection is an unhandled 'error' event and
    // takes the process down.
    client.on("error", (error) => console.error("Rate limiting: redis error —", error.message));

    await client.connect();

    store = new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
      prefix: process.env.REDIS_PREFIX || "ech:rl:"
    });

    backend = "redis";
    console.log(`Rate limiting: redis store at ${url.replace(/\/\/.*@/, "//***@")}`);
  } catch (error) {
    console.error(`Rate limiting: could not reach redis (${error.message}); using the in-process store.`);
    store = undefined;
    backend = "memory";
    if (client) {
      await client.quit().catch(() => {});
      client = undefined;
    }
  }

  return { backend };
}

/**
 * Builds a limiter on whichever store is active.
 *
 * Each limiter gets its own key prefix so the login budget and the OTP budget
 * are counted separately rather than sharing one bucket.
 */
function makeLimiter({ windowMs, limit, message, name, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    ...(message ? { message: { message } } : {}),
    ...(store
      ? {
          store: new (require("rate-limit-redis").default)({
            sendCommand: (...args) => client.sendCommand(args),
            prefix: `${process.env.REDIS_PREFIX || "ech:rl:"}${name}:`
          })
        }
      : {})
  });
}

async function closeRateLimitStore() {
  if (client) await client.quit().catch(() => {});
}

module.exports = { initRateLimitStore, makeLimiter, closeRateLimitStore, getBackend: () => backend };
