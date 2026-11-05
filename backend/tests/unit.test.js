const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
require("./helpers");

const { assertEnv } = require("../src/config/env");
const { activePlanKey, limitsFor } = require("../src/utils/entitlements");
const { requireVerified } = require("../src/middleware/authMiddleware");

function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("assertEnv", () => {
  const good = { JWT_SECRET: "x".repeat(40), PAYMENTS_ENABLED: undefined, FLW_PUBLIC_KEY: undefined, FLW_SECRET_KEY: undefined, FLW_WEBHOOK_HASH: undefined };

  test("accepts a safe free-launch configuration", () => {
    withEnv(good, () => assert.doesNotThrow(assertEnv));
  });

  test("rejects a missing or placeholder JWT secret", () => {
    withEnv({ ...good, JWT_SECRET: undefined }, () => assert.throws(assertEnv, /JWT_SECRET is not set/));
    withEnv({ ...good, JWT_SECRET: "changeme" }, () => assert.throws(assertEnv, /placeholder/));
  });

  test("refuses payments enabled without gateway keys or webhook hash", () => {
    withEnv({ ...good, PAYMENTS_ENABLED: "true" }, () => assert.throws(assertEnv, /FLW_PUBLIC_KEY and FLW_SECRET_KEY/));
    withEnv({ ...good, PAYMENTS_ENABLED: "true", FLW_PUBLIC_KEY: "a", FLW_SECRET_KEY: "b" }, () => assert.throws(assertEnv, /FLW_WEBHOOK_HASH/));
  });

  test("accepts payments enabled when fully configured", () => {
    withEnv({ ...good, PAYMENTS_ENABLED: "true", FLW_PUBLIC_KEY: "a", FLW_SECRET_KEY: "b", FLW_WEBHOOK_HASH: "c" }, () => assert.doesNotThrow(assertEnv));
  });
});

describe("mock payment gateway", () => {
  test("is unavailable in production", async () => {
    const { createPayment } = require("../src/utils/flutterwave");
    await withEnv({ NODE_ENV: "production", FLW_PUBLIC_KEY: undefined, FLW_SECRET_KEY: undefined }, async () => {
      await assert.rejects(() => createPayment({ txRef: "t", amountMinor: 1, currency: "TZS", redirectUrl: "http://x", customer: {} }), /mock gateway is disabled/);
    });
  });
});

describe("entitlements", () => {
  const future = new Date(Date.now() + 86400000);
  const past = new Date(Date.now() - 86400000);

  test("accounts without a subscription are on Free", () => {
    assert.equal(activePlanKey({ role: "student" }), "free");
    assert.equal(limitsFor({ role: "student" }).activeAds, 1);
  });

  test("an active Business Pro subscription lifts the ad limit", () => {
    const user = { role: "company", subscription: { planKey: "business_pro", status: "active", currentPeriodEnd: future } };
    assert.equal(limitsFor(user).activeAds, Infinity);
  });

  test("an expired, canceled or unknown plan falls back to Free", () => {
    assert.equal(activePlanKey({ subscription: { planKey: "business_pro", status: "active", currentPeriodEnd: past } }), "free");
    assert.equal(activePlanKey({ subscription: { planKey: "business_pro", status: "canceled" } }), "free");
    assert.equal(activePlanKey({ subscription: { planKey: "made_up", status: "active" } }), "free");
  });

  test("admins are never limited", () => {
    assert.equal(limitsFor({ role: "admin" }).activeAds, Infinity);
  });
});

describe("requireVerified", () => {
  const run = (user) => {
    let result = "next";
    requireVerified({ user }, { status: (code) => ({ json: (body) => (result = { code, body }) }) }, () => {});
    return result;
  };

  test("blocks unverified users of every role, admins included", () => {
    for (const role of ["student", "company", "mentor", "admin"]) {
      const result = run({ role, emailVerified: false });
      assert.equal(result.code, 403);
      assert.equal(result.body.code, "EMAIL_NOT_VERIFIED");
    }
  });

  test("lets verified users through", () => {
    assert.equal(run({ role: "student", emailVerified: true }), "next");
  });
});
