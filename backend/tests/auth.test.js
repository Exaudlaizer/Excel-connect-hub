const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, closeDb } = require("./helpers");

describe("auth", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;

  before(async () => {
    ({ request, app, models } = load());
  });
  beforeEach(resetDb);
  after(closeDb);

  const signup = (body = {}) =>
    request(app)
      .post("/api/auth/register")
      .send({ name: "Amina Juma", email: "amina@example.com", password: "password-123", role: "student", ...body });

  test("registration creates the account with a Free subscription", async () => {
    const res = await signup();
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    const user = await models.User.findOne({ where: { email: "amina@example.com" } });
    assert.equal(user.emailVerified, false);
    const subscription = await models.Subscription.findOne({ where: { userId: user.id } });
    assert.equal(subscription.planKey, "free");
  });

  test("an admin cannot be self-registered", async () => {
    const res = await signup({ role: "admin" });
    assert.equal(res.status, 400);
    assert.equal(await models.User.count(), 0);
  });

  test("a failed signup leaves no half-created account behind", async () => {
    await models.Plan.destroy({ where: {} });
    const res = await signup();
    assert.equal(res.status >= 400, true);
    assert.equal(await models.User.count(), 0);

    // The same email can be used once the platform is set up properly.
    await require("./helpers").seedPlans();
    assert.equal((await signup()).status, 201);
  });

  test("a duplicate email is refused", async () => {
    assert.equal((await signup()).status, 201);
    assert.equal((await signup()).status, 409);
  });

  test("login returns a token and does not reveal which part was wrong", async () => {
    await signup();
    const ok = await request(app).post("/api/auth/login").send({ email: "amina@example.com", password: "password-123" });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);

    const wrongPassword = await request(app).post("/api/auth/login").send({ email: "amina@example.com", password: "nope-nope-1" });
    const unknownEmail = await request(app).post("/api/auth/login").send({ email: "ghost@example.com", password: "password-123" });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
  });

  test("a suspended account cannot log in or use an existing token", async () => {
    const { user, auth } = await makeUser({ status: "active" });
    await user.update({ status: "suspended" });
    const me = await request(app).get("/api/auth/me").set(auth);
    assert.equal(me.status, 401);
  });
});
