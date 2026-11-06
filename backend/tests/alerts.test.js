const { test, describe, before, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, makeJob, captureMail, closeDb } = require("./helpers");
const { alertOperators, flushAlerts, resetAlertThrottle, configuredRecipients, THROTTLE_MS } = require("../src/utils/alerts");

const saved = {};
const setEnv = (vars) => {
  for (const [key, value] of Object.entries(vars)) {
    if (!(key in saved)) saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};
const restoreEnv = () => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    delete saved[key];
  }
};

// Runs fn and waits for any alert it started, returning everything that was "emailed".
const withAlerts = (fn) =>
  captureMail(async () => {
    const result = await fn();
    await flushAlerts();
    return result;
  });
const emailsIn = (mail) => (mail.match(/ To:\s+(\S+)/g) || []).map((line) => line.replace(/ To:\s+/, ""));

describe("recipients and throttling", () => {
  beforeEach(() => {
    resetAlertThrottle();
    setEnv({ ALERT_EMAILS: "ops@example.com" });
  });
  afterEach(restoreEnv);

  test("ALERT_EMAILS accepts commas, semicolons and spaces and drops junk", () => {
    setEnv({ ALERT_EMAILS: "a@example.com, b@example.com; c@example.com  not-an-email,@x.com" });
    assert.deepEqual(configuredRecipients(), ["a@example.com", "b@example.com", "c@example.com"]);
  });

  test("an alert is emailed to every configured address, with a clear subject", async () => {
    setEnv({ ALERT_EMAILS: "a@example.com,b@example.com" });
    const { result, mail } = await withAlerts(() => alertOperators({ key: "k1", subject: "Something broke", text: "Details here." }));
    assert.equal(result.sent, 2);
    assert.deepEqual(emailsIn(mail).sort(), ["a@example.com", "b@example.com"]);
    assert.match(mail, /Subject: \[Excel Connect Hub\] Something broke/);
    assert.match(mail, /Details here\./);
  });

  test("the same alert is sent once per 15 minutes, a different one is not held back", async () => {
    const t0 = 1_000_000;
    const first = await alertOperators({ key: "same", subject: "s", text: "t", now: t0 });
    const repeat = await alertOperators({ key: "same", subject: "s", text: "t", now: t0 + THROTTLE_MS - 1 });
    const other = await alertOperators({ key: "different", subject: "s", text: "t", now: t0 + 1 });
    const later = await alertOperators({ key: "same", subject: "s", text: "t", now: t0 + THROTTLE_MS });
    assert.equal(first.sent, 1);
    assert.equal(repeat.throttled, true);
    assert.equal(repeat.sent, 0);
    assert.equal(other.sent, 1);
    assert.equal(later.sent, 1, "allowed again once the window has passed");
  });

  test("a failure to send never throws and is not retried in a storm", async () => {
    const mailer = require("../src/utils/mailer");
    const original = mailer.sendMail;
    // alerts.js bound sendMail at load time, so break the transport underneath it.
    setEnv({ SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "u", SMTP_PASS: "p" });
    const errors = console.error;
    console.error = () => {};
    try {
      const result = await alertOperators({ key: "fail", subject: "s", text: "t" });
      assert.ok(result && typeof result === "object", "resolves instead of rejecting");
      const again = await alertOperators({ key: "fail", subject: "s", text: "t" });
      assert.equal(again.throttled, true);
    } finally {
      console.error = errors;
      mailer.sendMail = original;
    }
  });
});

describe("alerts raised by the application", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(async () => {
    await resetDb();
    resetAlertThrottle();
    setEnv({ ALERT_EMAILS: "ops@example.com", PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: undefined });
  });
  afterEach(restoreEnv);
  after(closeDb);

  test("with nobody to tell, it says so in the log and does not throw", async () => {
    setEnv({ ALERT_EMAILS: undefined });
    await makeUser({ role: "admin", emailVerified: false });
    const lines = [];
    const errors = console.error;
    console.error = (line) => lines.push(String(line));
    let result;
    try {
      result = await alertOperators({ key: "nobody", subject: "s", text: "t" });
    } finally {
      console.error = errors;
    }
    assert.equal(result.sent, 0);
    assert.equal(result.noRecipients, true);
    assert.ok(lines.some((line) => /no recipient/.test(line)));
  });

  test("with no ALERT_EMAILS, only active admins with a verified email are told", async () => {
    setEnv({ ALERT_EMAILS: undefined });
    const verified = await makeUser({ role: "admin", emailVerified: true });
    await makeUser({ role: "admin", emailVerified: false });
    const suspended = await makeUser({ role: "admin", emailVerified: true });
    await suspended.user.update({ status: "suspended" });
    await makeUser({ role: "student", emailVerified: true });

    const { mail } = await withAlerts(() => alertOperators({ key: "who", subject: "s", text: "t" }));
    assert.deepEqual(emailsIn(mail), [verified.user.email]);
  });

  test("a paid-but-wrong-amount payment alerts once, with facts and no secrets, and grants nothing", async () => {
    const mock = require("../src/payments").DRIVERS.mock;
    const { user, auth } = await makeUser({ role: "company" });
    const started = await request(app).post("/api/billing/checkout").set(auth).send({ planKey: "business_pro" });

    const original = mock.verifyPayment;
    mock.verifyPayment = async (args) => ({ ...(await original(args)), amountMinor: 100 });
    let captured;
    try {
      captured = await withAlerts(() => request(app).post("/api/billing/confirm").set(auth).send({ txRef: started.body.txRef }));
    } finally {
      mock.verifyPayment = original;
    }

    assert.equal(captured.result.status, 400);
    assert.match(captured.mail, /did not match what was charged/);
    assert.match(captured.mail, new RegExp(started.body.txRef));
    assert.match(captured.mail, /business_pro/);
    assert.ok(!captured.mail.includes(process.env.JWT_SECRET), "no secrets in the email");
    assert.ok(!captured.mail.includes("Bearer"));
    assert.equal((await models.Subscription.findOne({ where: { userId: user.id } })).planKey, "free");

    const audit = await models.AuditLog.findOne({ where: { action: "billing.verification_failed" } });
    assert.equal(audit.details.txRef, started.body.txRef);
    assert.equal(audit.actorId, null, "no person acted: it came from the gateway reply");
  });

  test("a payment the customer simply abandoned does NOT alert anyone", async () => {
    const mock = require("../src/payments").DRIVERS.mock;
    const { auth } = await makeUser({ role: "company" });
    const started = await request(app).post("/api/billing/checkout").set(auth).send({ planKey: "business_pro" });
    const original = mock.verifyPayment;
    mock.verifyPayment = async () => ({ ok: false, status: "cancelled" });
    let captured;
    try {
      captured = await withAlerts(() => request(app).post("/api/billing/confirm").set(auth).send({ txRef: started.body.txRef }));
    } finally {
      mock.verifyPayment = original;
    }
    assert.equal(captured.result.status, 400);
    assert.equal(emailsIn(captured.mail).length, 0);
    assert.equal(await models.AuditLog.count(), 0);
  });

  describe("webhook problems", () => {
    const useFlutterwave = () =>
      setEnv({ PAYMENT_PROVIDER: "flutterwave", FLW_PUBLIC_KEY: "pub", FLW_SECRET_KEY: "sec", FLW_WEBHOOK_HASH: "the-hash" });

    test("a bad signature alerts, then is quiet for 15 minutes", async () => {
      useFlutterwave();
      const first = await withAlerts(() => request(app).post("/api/billing/webhook").set("verif-hash", "wrong").send({ data: { tx_ref: "x" } }));
      assert.equal(first.result.status, 401);
      assert.match(first.mail, /invalid signature/i);
      assert.ok(!first.mail.includes("the-hash"), "the real secret must never be emailed");

      const second = await withAlerts(() => request(app).post("/api/billing/webhook").set("verif-hash", "wrong").send({ data: { tx_ref: "x" } }));
      assert.equal(second.result.status, 401);
      assert.equal(emailsIn(second.mail).length, 0, "throttled");
    });

    test("a correctly signed event does not alert", async () => {
      useFlutterwave();
      const res = await withAlerts(() => request(app).post("/api/billing/webhook").set("verif-hash", "the-hash").send({ data: { tx_ref: "unknown" } }));
      assert.equal(res.result.status, 200);
      assert.equal(emailsIn(res.mail).length, 0);
    });

    test("a misconfigured provider alerts", async () => {
      setEnv({ PAYMENT_PROVIDER: "flutterwave", FLW_PUBLIC_KEY: undefined, FLW_SECRET_KEY: undefined, FLW_WEBHOOK_HASH: undefined });
      const errors = console.error;
      console.error = () => {};
      let res;
      try {
        res = await withAlerts(() => request(app).post("/api/billing/webhook").send({ data: { tx_ref: "x" } }));
      } finally {
        console.error = errors;
      }
      assert.equal(res.result.status, 503);
      assert.match(res.mail, /misconfigured/i);
    });
  });

  describe("server errors", () => {
    const breakJobs = async (fn) => {
      const original = models.Job.findAndCountAll;
      const errors = console.error;
      const logged = [];
      console.error = (line) => logged.push(String(line));
      models.Job.findAndCountAll = async () => {
        throw new Error("simulated database failure with internal detail");
      };
      try {
        return { ...(await withAlerts(fn)), logged };
      } finally {
        models.Job.findAndCountAll = original;
        console.error = errors;
      }
    };

    test("a 500 emails the operators once with the request id, and the client sees nothing internal", async () => {
      setEnv({ NODE_ENV: "production" });
      const res = await breakJobs(() => request(app).get("/api/jobs"));
      assert.equal(res.result.status, 500);
      assert.ok(!JSON.stringify(res.result.body).includes("internal detail"));
      assert.equal(res.result.body.stack, undefined);

      const requestId = res.result.headers["x-request-id"];
      assert.ok(requestId);
      assert.match(res.mail, /returned a server error/);
      assert.match(res.mail, new RegExp(requestId));
      assert.match(res.mail, /GET \/api\/jobs/);
      assert.ok(!res.mail.includes(process.env.JWT_SECRET));
    });

    test("the failure is logged as one JSON line carrying the same request id", async () => {
      const res = await breakJobs(() => request(app).get("/api/jobs?secret=do-not-log-me"));
      const line = res.logged.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((o) => o && o.level === "error" && o.status === 500);
      assert.ok(line, "expected a JSON error line");
      assert.equal(line.requestId, res.result.headers["x-request-id"]);
      assert.equal(line.method, "GET");
      assert.equal(line.path, "/api/jobs", "the query string must not be logged");
      assert.match(line.stack, /simulated database failure/);
    });

    test("stack traces reach the client only when NODE_ENV opts in (development or test)", async () => {
      const results = {};
      for (const env of ["development", "test", "production", "staging", "prod", undefined]) {
        setEnv({ NODE_ENV: env });
        resetAlertThrottle();
        const res = await breakJobs(() => request(app).get("/api/jobs"));
        results[String(env)] = res.result.body.stack !== undefined;
      }
      assert.deepEqual(results, { development: true, test: true, production: false, staging: false, prod: false, undefined: false });
    });

    test("repeated 500s do not mean repeated emails", async () => {
      await breakJobs(() => request(app).get("/api/jobs"));
      const again = await breakJobs(() => request(app).get("/api/jobs"));
      assert.equal(emailsIn(again.mail).length, 0);
    });

    test("client errors (400, 401, 404) never alert", async () => {
      const { mail } = await withAlerts(async () => {
        await request(app).get("/api/does-not-exist");
        await request(app).get("/api/auth/me");
        await request(app).post("/api/auth/login").send({});
      });
      assert.equal(emailsIn(mail).length, 0);
    });
  });
});
