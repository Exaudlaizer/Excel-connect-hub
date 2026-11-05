const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, adPayload, closeDb } = require("./helpers");

describe("ads: publish gate and plan limit", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app;

  before(async () => {
    ({ request, app } = load());
    await resetDb();
  });
  beforeEach(resetDb);
  after(closeDb);

  const post = (auth, body = adPayload()) => request(app).post("/api/ads").set(auth).send(body);

  test("an unverified account cannot publish an ad", async () => {
    const { auth } = await makeUser({ role: "company", emailVerified: false });
    const res = await post(auth);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "EMAIL_NOT_VERIFIED");
  });

  test("anonymous requests are rejected", async () => {
    const res = await request(app).post("/api/ads").send(adPayload());
    assert.equal(res.status, 401);
  });

  test("a verified Free account may create one ad, which starts pending", async () => {
    const { auth } = await makeUser({ role: "company" });
    const res = await post(auth);
    assert.equal(res.status, 201);
    assert.equal(res.body.ad.status, "pending");
  });

  test("a second ad on the Free plan is refused with AD_LIMIT_REACHED", async () => {
    const { auth } = await makeUser({ role: "company" });
    assert.equal((await post(auth)).status, 201);
    const second = await post(auth, adPayload({ title: "Second advertisement" }));
    assert.equal(second.status, 403);
    assert.equal(second.body.code, "AD_LIMIT_REACHED");
  });

  test("a rejected ad frees the slot", async () => {
    const { user, auth } = await makeUser({ role: "company" });
    const first = await post(auth);
    await load().models.Ad.update({ status: "rejected" }, { where: { id: first.body.ad.id } });
    assert.equal((await post(auth, adPayload({ title: "Try again" }))).status, 201);
    assert.ok(user);
  });

  test("limits are per account", async () => {
    const a = await makeUser({ role: "company" });
    const b = await makeUser({ role: "company" });
    assert.equal((await post(a.auth)).status, 201);
    assert.equal((await post(b.auth)).status, 201);
  });

  test("Business Pro has no ad limit", async () => {
    const { auth } = await makeUser({ role: "company", plan: "business_pro" });
    for (let i = 0; i < 3; i += 1) {
      assert.equal((await post(auth, adPayload({ title: `Ad number ${i + 1}` }))).status, 201);
    }
  });

  test("admins are not limited", async () => {
    const { auth } = await makeUser({ role: "admin", emailVerified: true });
    assert.equal((await post(auth)).status, 201);
    assert.equal((await post(auth, adPayload({ title: "Another one" }))).status, 201);
  });
});
