const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, captureMail, extractResetToken, nextIp, closeDb } = require("./helpers");

describe("password reset", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const forgot = (email, ip = nextIp()) =>
    captureMail(() => request(app).post("/api/auth/forgot-password").set("X-Forwarded-For", ip).send({ email }));
  const reset = (token, password = "brand-new-pass-1") =>
    request(app).post("/api/auth/reset-password").set("X-Forwarded-For", nextIp()).send({ token, password });
  const login = (email, password) =>
    request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email, password });

  test("a reset link is emailed, the token is stored only as a hash, and it changes the password", async () => {
    const { user } = await makeUser();
    const { result, mail } = await forgot(user.email);
    assert.equal(result.status, 200);

    const token = extractResetToken(mail);
    assert.match(token, /^[0-9a-f]{64}$/);

    const row = await models.PasswordResetToken.findOne({ where: { userId: user.id } });
    assert.notEqual(row.tokenHash, token, "the raw token must not be stored");

    assert.equal((await reset(token)).status, 200);
    assert.equal((await login(user.email, "password-123")).status, 401, "the old password must stop working");
    assert.equal((await login(user.email, "brand-new-pass-1")).status, 200);
  });

  test("known, unknown and suspended addresses all get an identical answer", async () => {
    const active = await makeUser();
    const suspended = await makeUser();
    await suspended.user.update({ status: "suspended" });

    const a = await forgot(active.user.email);
    const b = await forgot("nobody@example.com");
    const c = await forgot(suspended.user.email);

    for (const other of [b, c]) {
      assert.equal(other.result.status, a.result.status);
      assert.deepEqual(other.result.body, a.result.body);
    }
    assert.ok(extractResetToken(a.mail));
    assert.equal(extractResetToken(b.mail), undefined);
    assert.equal(extractResetToken(c.mail), undefined);
    assert.equal(await models.PasswordResetToken.count({ where: { userId: suspended.user.id } }), 0);
  });

  test("a token works once only", async () => {
    const { user } = await makeUser();
    const token = extractResetToken((await forgot(user.email)).mail);
    assert.equal((await reset(token)).status, 200);
    assert.equal((await reset(token, "another-pass-2")).status, 400);
    assert.equal((await login(user.email, "brand-new-pass-1")).status, 200, "the second attempt must not change the password");
  });

  test("an expired token is refused", async () => {
    const { user } = await makeUser();
    const token = extractResetToken((await forgot(user.email)).mail);
    await models.PasswordResetToken.update({ expiresAt: new Date(Date.now() - 1000) }, { where: {} });
    assert.equal((await reset(token)).status, 400);
    assert.equal((await login(user.email, "password-123")).status, 200, "the password must be unchanged");
  });

  test("requesting again invalidates the earlier link", async () => {
    const { user } = await makeUser();
    const first = extractResetToken((await forgot(user.email)).mail);
    const second = extractResetToken((await forgot(user.email)).mail);
    assert.notEqual(first, second);
    assert.equal((await reset(first)).status, 400);
    assert.equal((await reset(second)).status, 200);
  });

  test("reset requests are rate limited per client address", async () => {
    const { user } = await makeUser();
    const ip = nextIp();
    for (let i = 0; i < 5; i += 1) assert.equal((await forgot(user.email, ip)).result.status, 200);
    const sixth = await forgot(user.email, ip);
    assert.equal(sixth.result.status, 429);
    assert.equal(extractResetToken(sixth.mail), undefined, "no email may be sent once limited");
    assert.equal((await forgot(user.email, nextIp())).result.status, 200, "a different address is unaffected");
  });

  test("a made-up token is refused", async () => {
    assert.equal((await reset("0".repeat(64))).status, 400);
  });

  test("the new password must be at least 8 characters", async () => {
    const { user } = await makeUser();
    const token = extractResetToken((await forgot(user.email)).mail);
    assert.equal((await reset(token, "short")).status, 400);
    assert.equal((await reset(token)).status, 200, "a rejected attempt must not burn the token");
  });

  test("an account suspended after requesting a link cannot use it", async () => {
    const { user } = await makeUser();
    const token = extractResetToken((await forgot(user.email)).mail);
    await user.update({ status: "suspended" });
    assert.equal((await reset(token)).status, 403);
  });
});
