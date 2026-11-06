const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { hasDb, load, closeDb } = require("./helpers");
const monitoring = require("../src/utils/monitoring");
const { installProcessHandlers } = require("../src/utils/processGuards");

describe("error reporting (Sentry)", () => {
  test("does nothing without a DSN", () => {
    monitoring._setClient(null);
    assert.equal(monitoring.init({ dsn: undefined }), false);
    assert.equal(monitoring.captureException(new Error("x")), false);
  });

  test("with a DSN it starts the client with PII off and the scrubber attached", () => {
    let options;
    const fake = { init: (o) => (options = o), captureException: () => {}, flush: async () => true };
    assert.equal(monitoring.init({ dsn: "https://key@example.ingest.sentry.io/1", sentry: fake }), true);
    assert.equal(options.sendDefaultPii, false);
    assert.equal(options.beforeSend, monitoring.scrubEvent);
    monitoring._setClient(null);
  });

  test("captured errors carry only the safe context given", () => {
    const calls = [];
    monitoring._setClient({ captureException: (error, scope) => calls.push([error, scope]), flush: async () => true });
    assert.equal(monitoring.captureException(new Error("boom"), { requestId: "r1", method: "GET", path: "/api/x", status: 500 }), true);
    assert.deepEqual(calls[0][1], { extra: { requestId: "r1", method: "GET", path: "/api/x", status: 500 } });
    monitoring._setClient(null);
  });

  test("a failing reporter never throws into the request", () => {
    monitoring._setClient({ captureException: () => { throw new Error("sentry down"); }, flush: async () => true });
    assert.equal(monitoring.captureException(new Error("x")), false);
    monitoring._setClient(null);
  });

  test("the scrubber removes headers, cookies, bodies, query strings and user details", () => {
    const event = {
      message: "keep me",
      request: { url: "https://api/x", method: "POST", headers: { authorization: "Bearer secret" }, cookies: { a: "b" }, data: { password: "p" }, query_string: "token=abc" },
      user: { id: "1", email: "a@b.co", ip_address: "1.2.3.4" }
    };
    const out = monitoring.scrubEvent(event);
    assert.equal(out.message, "keep me");
    assert.equal(out.request.method, "POST");
    for (const field of ["headers", "cookies", "data", "query_string"]) assert.equal(out.request[field], undefined, field);
    assert.equal(out.user, undefined);
    assert.ok(!JSON.stringify(out).includes("secret"));
  });
});

describe("crash handlers", () => {
  const build = (overrides = {}) => {
    const proc = new EventEmitter();
    const seen = { alerts: [], captured: [], flushed: 0, exits: [], logs: [] };
    installProcessHandlers({
      proc,
      alert: async (a) => seen.alerts.push(a),
      capture: (e, ctx) => seen.captured.push([e.message, ctx]),
      flush: async () => { seen.flushed += 1; },
      exit: (code) => seen.exits.push(code),
      log: (line) => seen.logs.push(line),
      waitMs: 50,
      ...overrides
    });
    return { proc, seen };
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  test("an uncaught exception is logged, reported, alerted, flushed, then the process exits with 1", async () => {
    const { proc, seen } = build();
    proc.emit("uncaughtException", new Error("kaboom"));
    await settle();
    assert.equal(JSON.parse(seen.logs[0]).kind, "uncaughtException");
    assert.deepEqual(seen.captured[0], ["kaboom", { kind: "uncaughtException" }]);
    assert.equal(seen.alerts[0].key, "process-crash");
    assert.match(seen.alerts[0].text, /kaboom/);
    assert.equal(seen.flushed, 1);
    assert.deepEqual(seen.exits, [1]);
  });

  test("an unhandled rejection with a non-Error value is handled too", async () => {
    const { proc, seen } = build();
    proc.emit("unhandledRejection", "just a string");
    await settle();
    assert.equal(JSON.parse(seen.logs[0]).message, "just a string");
    assert.deepEqual(seen.exits, [1]);
  });

  test("a second error while shutting down does not run the handler twice", async () => {
    const { proc, seen } = build();
    proc.emit("uncaughtException", new Error("one"));
    proc.emit("uncaughtException", new Error("two"));
    await settle();
    assert.equal(seen.alerts.length, 1);
    assert.deepEqual(seen.exits, [1]);
  });

  test("a hung alert cannot keep a crashed process alive", async () => {
    const { proc, seen } = build({ alert: () => new Promise(() => {}), waitMs: 30 });
    proc.emit("uncaughtException", new Error("stuck"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(seen.exits, [1]);
  });

  test("it still exits if reporting itself throws", async () => {
    const { proc, seen } = build({ capture: () => { throw new Error("reporter broke"); } });
    proc.emit("uncaughtException", new Error("x"));
    await settle();
    assert.deepEqual(seen.exits, [1]);
  });
});

describe("request ids and readiness", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, sequelize;
  before(() => ({ request, app, sequelize } = load()));
  after(closeDb);

  test("every response carries an X-Request-Id", async () => {
    const res = await request(app).get("/health");
    assert.match(res.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  });

  test("a sensible caller-supplied id is kept; an unsafe one is replaced", async () => {
    const kept = await request(app).get("/health").set("X-Request-Id", "client-abc-12345");
    assert.equal(kept.headers["x-request-id"], "client-abc-12345");
    for (const bad of ["short", "has spaces in it!!", "x".repeat(200), "<script>alert(1)</script>"]) {
      const res = await request(app).get("/health").set("X-Request-Id", bad);
      assert.notEqual(res.headers["x-request-id"], bad);
      assert.match(res.headers["x-request-id"], /^[0-9a-f-]{36}$/);
    }
  });

  test("browsers may read the request id", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:3000");
    assert.match(String(res.headers["access-control-expose-headers"]), /X-Request-Id/i);
  });

  test("/health/ready is 200 when the database answers", async () => {
    const res = await request(app).get("/health/ready");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok", database: "up" });
  });

  test("/health/ready is 503 when the database is down, and says nothing about why", async () => {
    const original = sequelize.query;
    sequelize.query = async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2");
    };
    try {
      const res = await request(app).get("/health/ready");
      assert.equal(res.status, 503);
      assert.deepEqual(res.body, { status: "unavailable", database: "down" });
    } finally {
      sequelize.query = original;
    }
  });

  test("/health stays up even when the database is down (liveness is not readiness)", async () => {
    const original = sequelize.query;
    sequelize.query = async () => {
      throw new Error("db down");
    };
    try {
      assert.equal((await request(app).get("/health")).status, 200);
    } finally {
      sequelize.query = original;
    }
  });
});
