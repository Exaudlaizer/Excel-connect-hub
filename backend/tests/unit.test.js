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
  const clean = {
    JWT_SECRET: "x".repeat(40),
    PAYMENTS_ENABLED: undefined,
    PAYMENT_PROVIDER: undefined,
    FLW_PUBLIC_KEY: undefined,
    FLW_SECRET_KEY: undefined,
    FLW_WEBHOOK_HASH: undefined
  };

  test("accepts a safe free-launch configuration", () => {
    withEnv(clean, () => assert.doesNotThrow(assertEnv));
  });

  test("rejects a missing or placeholder JWT secret", () => {
    withEnv({ ...clean, JWT_SECRET: undefined }, () => assert.throws(assertEnv, /JWT_SECRET is not set/));
    withEnv({ ...clean, JWT_SECRET: "changeme" }, () => assert.throws(assertEnv, /placeholder/));
  });

  test("rejects an unrecognised PAYMENT_PROVIDER even while payments are off", () => {
    withEnv({ ...clean, PAYMENT_PROVIDER: "selcomm" }, () => assert.throws(assertEnv, /not recognised/));
  });

  test("refuses payments enabled with the mock gateway", () => {
    withEnv({ ...clean, PAYMENTS_ENABLED: "true" }, () => assert.throws(assertEnv, /requires PAYMENT_PROVIDER to be a real gateway/));
    withEnv({ ...clean, PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: "mock" }, () => assert.throws(assertEnv, /real gateway/));
  });

  test("refuses payments enabled when the chosen gateway is missing credentials", () => {
    withEnv({ ...clean, PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: "flutterwave" }, () =>
      assert.throws(assertEnv, /FLW_PUBLIC_KEY, FLW_SECRET_KEY, FLW_WEBHOOK_HASH/)
    );
    withEnv({ ...clean, PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: "flutterwave", FLW_PUBLIC_KEY: "a", FLW_SECRET_KEY: "b" }, () =>
      assert.throws(assertEnv, /FLW_WEBHOOK_HASH/)
    );
  });

  test("accepts payments enabled when the gateway is fully configured", () => {
    withEnv({ ...clean, PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: "flutterwave", FLW_PUBLIC_KEY: "a", FLW_SECRET_KEY: "b", FLW_WEBHOOK_HASH: "c" }, () =>
      assert.doesNotThrow(assertEnv)
    );
  });
});

describe("payment provider registry", () => {
  const { getProvider, getProviderByName, knownProviders, newTxRef } = require("../src/payments");

  test("defaults to the mock gateway outside production", () => {
    withEnv({ NODE_ENV: "test", PAYMENT_PROVIDER: undefined }, () => assert.equal(getProvider().name, "mock"));
  });

  test("the mock gateway is unavailable in production", () => {
    withEnv({ NODE_ENV: "production", PAYMENT_PROVIDER: undefined }, () => assert.throws(getProvider, /disabled in production/));
    withEnv({ NODE_ENV: "production" }, () => assert.throws(() => getProviderByName("mock"), /disabled in production/));
  });

  test("a real gateway cannot be used without its credentials", () => {
    withEnv({ PAYMENT_PROVIDER: "flutterwave", FLW_PUBLIC_KEY: undefined, FLW_SECRET_KEY: undefined, FLW_WEBHOOK_HASH: undefined }, () =>
      assert.throws(getProvider, /missing configuration/)
    );
  });

  test("an unknown provider name is an error, not a silent fallback", () => {
    assert.throws(() => getProviderByName("nope"), /Unknown payment provider/);
  });

  test("every registered driver implements the full interface", () => {
    for (const name of knownProviders()) {
      const driver = require("../src/payments").DRIVERS[name];
      assert.equal(driver.name, name);
      assert.ok(Array.isArray(driver.requiredEnv));
      for (const fn of ["createPayment", "verifyPayment", "verifyWebhook", "parseWebhook"]) {
        assert.equal(typeof driver[fn], "function", `${name}.${fn}`);
      }
    }
  });

  test("references are unique", () => {
    assert.notEqual(newTxRef(), newTxRef());
    assert.match(newTxRef(), /^ech-\d+-[0-9a-f]{12}$/);
  });
});

describe("flutterwave webhook signature", () => {
  const driver = require("../src/payments/flutterwave");
  const req = (hash) => ({ headers: hash === undefined ? {} : { "verif-hash": hash } });

  test("accepts only the configured hash", () => {
    withEnv({ FLW_WEBHOOK_HASH: "s3cret-hash" }, () => {
      assert.equal(driver.verifyWebhook(req("s3cret-hash")), true);
      assert.equal(driver.verifyWebhook(req("wrong-hash!")), false);
      assert.equal(driver.verifyWebhook(req("short")), false);
      assert.equal(driver.verifyWebhook(req(undefined)), false);
    });
  });

  test("rejects everything when no hash is configured", () => {
    withEnv({ FLW_WEBHOOK_HASH: undefined }, () => assert.equal(driver.verifyWebhook(req("anything")), false));
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
