const { test, describe, before, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, closeDb } = require("./helpers");

describe("billing", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models, mock;
  const saved = {};

  const setEnv = (vars) => {
    for (const [key, value] of Object.entries(vars)) {
      if (!(key in saved)) saved[key] = process.env[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };

  before(() => {
    ({ request, app, models } = load());
    mock = require("../src/payments").DRIVERS.mock;
  });
  beforeEach(async () => {
    await resetDb();
    setEnv({ PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: undefined });
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      delete saved[key];
    }
  });
  after(closeDb);

  const checkout = (auth, planKey = "business_pro") => request(app).post("/api/billing/checkout").set(auth).send({ planKey });
  const confirm = (auth, txRef) => request(app).post("/api/billing/confirm").set(auth).send({ txRef });
  const subscriptionOf = (user) => models.Subscription.findOne({ where: { userId: user.id } });

  test("checkout is refused while payments are disabled", async () => {
    setEnv({ PAYMENTS_ENABLED: "false" });
    const { auth } = await makeUser({ role: "company" });
    const res = await checkout(auth);
    assert.equal(res.status, 503);
    assert.equal(res.body.comingSoon, true);
    assert.equal(await models.Payment.count(), 0);
  });

  test("a purchase upgrades the plan only after verification, and records the provider", async () => {
    const { user, auth } = await makeUser({ role: "company" });
    const started = await checkout(auth);
    assert.equal(started.status, 200);
    assert.equal(started.body.mock, true);

    // Starting checkout changes nothing about the subscription.
    assert.equal((await subscriptionOf(user)).planKey, "free");

    const done = await confirm(auth, started.body.txRef);
    assert.equal(done.status, 200);

    const subscription = await subscriptionOf(user);
    assert.equal(subscription.planKey, "business_pro");
    assert.equal(subscription.provider, "mock");
    assert.ok(subscription.currentPeriodEnd > new Date());
    assert.equal((await models.Payment.findOne({ where: { txRef: started.body.txRef } })).provider, "mock");
  });

  test("confirming the same payment twice does not grant a second period", async () => {
    const { user, auth } = await makeUser({ role: "company" });
    const { body } = await checkout(auth);
    assert.equal((await confirm(auth, body.txRef)).status, 200);
    const firstEnd = (await subscriptionOf(user)).currentPeriodEnd.getTime();

    assert.equal((await confirm(auth, body.txRef)).status, 200);
    assert.equal((await subscriptionOf(user)).currentPeriodEnd.getTime(), firstEnd);
    assert.equal(await models.Payment.count({ where: { status: "successful" } }), 1);
  });

  test("a verified amount that differs from the price is refused and nothing is granted", async () => {
    const { user, auth } = await makeUser({ role: "company" });
    const { body } = await checkout(auth);

    const original = mock.verifyPayment;
    mock.verifyPayment = async (args) => ({ ...(await original(args)), amountMinor: 100 });
    try {
      const res = await confirm(auth, body.txRef);
      assert.equal(res.status, 400);
    } finally {
      mock.verifyPayment = original;
    }
    assert.equal((await subscriptionOf(user)).planKey, "free");
    assert.equal((await models.Payment.findOne({ where: { txRef: body.txRef } })).status, "failed");
  });

  test("a mismatched currency is refused too", async () => {
    const { user, auth } = await makeUser({ role: "company" });
    const { body } = await checkout(auth);
    const original = mock.verifyPayment;
    mock.verifyPayment = async (args) => ({ ...(await original(args)), currency: "USD" });
    try {
      assert.equal((await confirm(auth, body.txRef)).status, 400);
    } finally {
      mock.verifyPayment = original;
    }
    assert.equal((await subscriptionOf(user)).planKey, "free");
  });

  test("an unknown payment reference grants nothing", async () => {
    const { user, auth } = await makeUser({ role: "company" });
    assert.equal((await confirm(auth, "ech-does-not-exist")).status, 400);
    assert.equal((await subscriptionOf(user)).planKey, "free");
  });

  test("a payment is verified by the provider that created it, even after the active provider changes", async () => {
    const { user, auth } = await makeUser({ role: "company" });
    const { body } = await checkout(auth); // created by the mock
    setEnv({ PAYMENT_PROVIDER: "flutterwave", FLW_PUBLIC_KEY: "a", FLW_SECRET_KEY: "b", FLW_WEBHOOK_HASH: "c" });
    assert.equal((await confirm(auth, body.txRef)).status, 200);
    assert.equal((await subscriptionOf(user)).provider, "mock");
  });

  test("a plan can only be bought by the account types it is for", async () => {
    const { auth } = await makeUser({ role: "student" });
    assert.equal((await checkout(auth, "business_pro")).status, 403);
    assert.equal(await models.Payment.count(), 0);
  });

  test("the Free plan cannot be 'purchased' and unknown plans are rejected", async () => {
    const { auth } = await makeUser({ role: "company" });
    assert.equal((await checkout(auth, "free")).status, 400);
    assert.equal((await checkout(auth, "no_such_plan")).status, 404);
  });

  test("checkout requires a signed-in user", async () => {
    assert.equal((await request(app).post("/api/billing/checkout").send({ planKey: "business_pro" })).status, 401);
  });

  describe("webhook (flutterwave signing)", () => {
    const configure = () =>
      setEnv({ PAYMENT_PROVIDER: "flutterwave", FLW_PUBLIC_KEY: "pub", FLW_SECRET_KEY: "sec", FLW_WEBHOOK_HASH: "the-hash" });

    test("a bad signature is rejected", async () => {
      configure();
      const res = await request(app).post("/api/billing/webhook").set("verif-hash", "wrong").send({ data: { tx_ref: "x" } });
      assert.equal(res.status, 401);
    });

    test("a missing signature is rejected", async () => {
      configure();
      const res = await request(app).post("/api/billing/webhook").send({ data: { tx_ref: "x" } });
      assert.equal(res.status, 401);
    });

    test("a correctly signed event for an unknown reference is acknowledged and grants nothing", async () => {
      configure();
      const res = await request(app).post("/api/billing/webhook").set("verif-hash", "the-hash").send({ data: { tx_ref: "unknown", id: 1 } });
      assert.equal(res.status, 200);
      assert.equal(await models.Payment.count({ where: { status: "successful" } }), 0);
    });

    test("a misconfigured provider answers 503 instead of pretending the event was handled", async () => {
      setEnv({ PAYMENT_PROVIDER: "flutterwave", FLW_PUBLIC_KEY: undefined, FLW_SECRET_KEY: undefined, FLW_WEBHOOK_HASH: undefined });
      const res = await request(app).post("/api/billing/webhook").send({ data: { tx_ref: "x" } });
      assert.equal(res.status, 503);
    });
  });
});
