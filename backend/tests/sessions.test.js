const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { hasDb, load, resetDb, makeUser, captureMail, extractResetToken, nextIp, closeDb } = require("./helpers");

const HOUR = 3600;

describe("sessions: revocation, renewal and login throttling", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const login = (email, password = "password-123", ip = nextIp()) =>
    request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({ email, password });
  const me = (token) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  // Signs a token by hand so a test controls its age and version.
  const sign = (user, { tv, ageSeconds = 0, lifetime = 24 * HOUR } = {}) =>
    jwt.sign(
      { id: user.id, role: user.role, ...(tv === undefined ? {} : { tv }), iat: Math.floor(Date.now() / 1000) - ageSeconds },
      process.env.JWT_SECRET,
      { expiresIn: lifetime }
    );

  describe("login tokens", () => {
    test("carry the account's token version and last 24 hours by default", async () => {
      const { user } = await makeUser();
      const res = await login(user.email);
      assert.equal(res.status, 200);
      const decoded = jwt.decode(res.body.token);
      assert.equal(decoded.tv, 0);
      assert.equal(decoded.exp - decoded.iat, 24 * HOUR);
    });
  });

  describe("revocation", () => {
    test("a password reset cancels every existing login", async () => {
      const { user } = await makeUser();
      const old = (await login(user.email)).body.token;
      assert.equal((await me(old)).status, 200);

      const { mail } = await captureMail(() =>
        request(app).post("/api/auth/forgot-password").set("X-Forwarded-For", nextIp()).send({ email: user.email })
      );
      const res = await request(app).post("/api/auth/reset-password").set("X-Forwarded-For", nextIp()).send({ token: extractResetToken(mail), password: "brand-new-pass-1" });
      assert.equal(res.status, 200);

      assert.equal((await me(old)).status, 401, "the token issued before the reset must stop working");
      const fresh = (await login(user.email, "brand-new-pass-1")).body.token;
      assert.equal((await me(fresh)).status, 200);
    });

    test("suspending and later reinstating an account does not revive its old logins", async () => {
      const admin = await makeUser({ role: "admin" });
      const { user } = await makeUser();
      const old = (await login(user.email)).body.token;

      await request(app).patch(`/api/users/${user.id}/status`).set(admin.auth).send({ status: "suspended" });
      assert.equal((await me(old)).status, 401);
      await request(app).patch(`/api/users/${user.id}/status`).set(admin.auth).send({ status: "active" });
      assert.equal((await me(old)).status, 401, "reinstating must not bring back a token from before the suspension");
      assert.equal((await me((await login(user.email)).body.token)).status, 200);
    });

    test("a role change cancels existing logins", async () => {
      const admin = await makeUser({ role: "admin" });
      const { user } = await makeUser({ role: "student" });
      const old = (await login(user.email)).body.token;
      await request(app).patch(`/api/users/${user.id}/role`).set(admin.auth).send({ role: "mentor" });
      assert.equal((await me(old)).status, 401);
    });

    test("'sign out everywhere' cancels every device's token but not other people's", async () => {
      const { user } = await makeUser();
      const other = await makeUser();
      const phone = (await login(user.email)).body.token;
      const laptop = (await login(user.email)).body.token;
      const strangersToken = (await login(other.user.email)).body.token;

      const res = await request(app).post("/api/auth/logout-all").set(bearer(laptop)).send({});
      assert.equal(res.status, 200);

      assert.equal((await me(phone)).status, 401);
      assert.equal((await me(laptop)).status, 401);
      assert.equal((await me(strangersToken)).status, 200);
      assert.equal((await me((await login(user.email)).body.token)).status, 200, "signing in again works");
    });

    test("a token with no version is accepted only while the account is still at version 0", async () => {
      const { user } = await makeUser();
      assert.equal((await me(sign(user))).status, 200);
      await user.increment("tokenVersion");
      assert.equal((await me(sign(user))).status, 401);
    });

    test("a token claiming a different version is refused", async () => {
      const { user } = await makeUser();
      assert.equal((await me(sign(user, { tv: 7 }))).status, 401);
      assert.equal((await me(sign(user, { tv: 0 }))).status, 200);
    });

    test("a revoked token is also treated as anonymous on public listings", async () => {
      const company = await makeUser({ role: "company" });
      const ad = await models.Ad.create({ ownerId: company.user.id, title: "Hidden draft", category: "food", description: "A pending advertisement.", contact: "x", status: "pending" });
      const token = (await login(company.user.email)).body.token;
      assert.ok((await request(app).get("/api/ads").set(bearer(token))).body.ads.some((a) => a.id === ad.id), "owner sees their pending ad");
      await company.user.increment("tokenVersion");
      assert.ok(!(await request(app).get("/api/ads").set(bearer(token))).body.ads.some((a) => a.id === ad.id), "after revocation it must not");
    });
  });

  describe("renewal", () => {
    test("a token older than 12 hours is renewed with a fresh one", async () => {
      const { user } = await makeUser();
      const res = await me(sign(user, { tv: 0, ageSeconds: 13 * HOUR }));
      assert.equal(res.status, 200);
      const renewed = res.headers["x-renewed-token"];
      assert.ok(renewed, "expected an X-Renewed-Token header");
      const decoded = jwt.decode(renewed);
      assert.equal(decoded.tv, 0);
      assert.ok(decoded.exp - decoded.iat === 24 * HOUR);
      assert.equal((await me(renewed)).status, 200, "the renewed token works");
    });

    test("a recent token is not renewed", async () => {
      const { user } = await makeUser();
      const res = await me(sign(user, { tv: 0, ageSeconds: 2 * HOUR }));
      assert.equal(res.status, 200);
      assert.equal(res.headers["x-renewed-token"], undefined);
    });

    test("an expired token is refused, not renewed", async () => {
      const { user } = await makeUser();
      const res = await me(sign(user, { tv: 0, ageSeconds: 30 * HOUR }));
      assert.equal(res.status, 401);
      assert.equal(res.headers["x-renewed-token"], undefined);
    });

    test("a revoked token is never renewed", async () => {
      const { user } = await makeUser();
      await user.increment("tokenVersion");
      const res = await me(sign(user, { tv: 0, ageSeconds: 13 * HOUR }));
      assert.equal(res.status, 401);
      assert.equal(res.headers["x-renewed-token"], undefined);
    });

    test("browsers are allowed to read the renewal header", async () => {
      const res = await request(app).get("/api/jobs").set("Origin", "http://localhost:3000");
      assert.match(String(res.headers["access-control-expose-headers"]), /X-Renewed-Token/i);
    });
  });

  describe("per-account login throttle", () => {
    const wrong = (email, ip) => login(email, "wrong-password-1", ip);

    test("five wrong attempts lock further attempts for that account, even from other addresses", async () => {
      const { user } = await makeUser();
      for (let i = 0; i < 5; i += 1) assert.equal((await wrong(user.email)).status, 401);
      const sixth = await wrong(user.email);
      assert.equal(sixth.status, 429);
      const right = await login(user.email);
      assert.equal(right.status, 429, "even the right password is refused while locked");
    });

    test("an unknown email behaves exactly the same, so the throttle reveals nothing", async () => {
      const known = await makeUser();
      const attempt = async (email) => {
        const out = [];
        for (let i = 0; i < 6; i += 1) {
          const res = await wrong(email);
          out.push([res.status, res.body.message]);
        }
        return out;
      };
      const forKnown = await attempt(known.user.email);
      const forUnknown = await attempt("nobody-here@example.com");
      assert.deepEqual(forKnown, forUnknown);
      assert.equal(forKnown[5][0], 429);
    });

    test("capitalisation does not give an attacker a fresh budget", async () => {
      const { user } = await makeUser();
      for (let i = 0; i < 5; i += 1) await wrong(user.email.toUpperCase());
      assert.equal((await wrong(user.email)).status, 429);
    });

    test("successful logins are not counted", async () => {
      const { user } = await makeUser();
      for (let i = 0; i < 8; i += 1) assert.equal((await login(user.email)).status, 200);
      assert.equal((await wrong(user.email)).status, 401, "the account is still unlocked");
    });

    test("one account's lockout does not affect another", async () => {
      const a = await makeUser();
      const b = await makeUser();
      for (let i = 0; i < 6; i += 1) await wrong(a.user.email);
      assert.equal((await login(b.user.email)).status, 200);
    });
  });
});
