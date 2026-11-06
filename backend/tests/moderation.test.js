const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, makeJob, makeCourse, makeAd, jobPayload, coursePayload, adPayload, closeDb } = require("./helpers");

// Nothing a user submits may reach the public until an admin approves it, and
// an edit must not let approved content be swapped for something else.
describe("moderation", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const ids = (res, key) => res.body[key].map((row) => row.id);

  for (const kind of [
    { name: "job", list: "/api/jobs", key: "jobs", ownerRole: "company", create: "/api/jobs", payload: jobPayload, make: makeJob, approve: (id) => `/api/jobs/${id}/approval`, edit: (id) => `/api/jobs/${id}`, editBody: (title) => ({ title }), ownerKey: "job" },
    { name: "ad", list: "/api/ads", key: "ads", ownerRole: "company", create: "/api/ads", payload: adPayload, make: makeAd, approve: (id) => `/api/ads/${id}/approval`, edit: (id) => `/api/ads/${id}`, editBody: (title) => adPayload({ title }), ownerKey: "ad" },
    { name: "course", list: "/api/courses", key: "courses", ownerRole: "mentor", create: "/api/courses", payload: coursePayload, make: makeCourse, approve: (id) => `/api/courses/${id}/approval`, edit: (id) => `/api/courses/${id}`, editBody: (title) => ({ title }), ownerKey: "course" }
  ]) {
    describe(kind.name, () => {
      test("starts pending and is hidden from the public and from other users", async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const stranger = await makeUser({ role: "student" });
        const created = await request(app).post(kind.create).set(owner.auth).send(kind.payload());
        assert.equal(created.status, 201);
        assert.equal(created.body[kind.ownerKey].status, "pending");
        const id = created.body[kind.ownerKey].id;

        assert.ok(!ids(await request(app).get(kind.list), kind.key).includes(id), "anonymous must not see it");
        assert.ok(!ids(await request(app).get(kind.list).set(stranger.auth), kind.key).includes(id), "another user must not see it");
      });

      test("is visible to its owner and to an admin while pending", async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const admin = await makeUser({ role: "admin" });
        const row = await kind.make(owner.user, { status: "pending" });
        assert.ok(ids(await request(app).get(kind.list).set(owner.auth), kind.key).includes(row.id), "owner");
        assert.ok(ids(await request(app).get(kind.list).set(admin.auth), kind.key).includes(row.id), "admin");
      });

      test("another owner of the same kind cannot see a rival's pending item", async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const rival = await makeUser({ role: kind.ownerRole });
        const row = await kind.make(owner.user, { status: "pending" });
        assert.ok(!ids(await request(app).get(kind.list).set(rival.auth), kind.key).includes(row.id));
      });

      test("becomes public once an admin approves it, and not before", async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const admin = await makeUser({ role: "admin" });
        const row = await kind.make(owner.user, { status: "pending" });

        const byOwner = await request(app).patch(kind.approve(row.id)).set(owner.auth).send({ status: "approved" });
        assert.equal(byOwner.status, 403, "an owner must not approve their own item");
        assert.ok(!ids(await request(app).get(kind.list), kind.key).includes(row.id));

        const byAdmin = await request(app).patch(kind.approve(row.id)).set(admin.auth).send({ status: "approved" });
        assert.equal(byAdmin.status, 200);
        assert.ok(ids(await request(app).get(kind.list), kind.key).includes(row.id));
      });

      test("an owner cannot approve it by sending status in a normal edit", async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const row = await kind.make(owner.user, { status: "pending" });
        await request(app).patch(kind.edit(row.id)).set(owner.auth).send({ ...kind.editBody("Sneaky edit title"), status: "approved" });
        assert.notEqual((await row.reload()).status, "approved");
      });

      test("editing approved content sends it back to review and off the public list", async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const row = await kind.make(owner.user, { status: "approved" });
        assert.ok(ids(await request(app).get(kind.list), kind.key).includes(row.id));

        const res = await request(app).patch(kind.edit(row.id)).set(owner.auth).send(kind.editBody("Completely different title"));
        assert.equal(res.status, 200);
        assert.equal((await row.reload()).status, "pending", "approved content must be re-reviewed after an edit");
        assert.ok(!ids(await request(app).get(kind.list), kind.key).includes(row.id));
      });

      test("someone else cannot edit it", async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const rival = await makeUser({ role: kind.ownerRole });
        const row = await kind.make(owner.user, { status: "approved" });
        const res = await request(app).patch(kind.edit(row.id)).set(rival.auth).send(kind.editBody("Hijacked title here"));
        assert.equal(res.status, 403);
        assert.notEqual((await row.reload()).title, "Hijacked title here");
      });

      test("a suspended owner is treated as anonymous on the listing", async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const row = await kind.make(owner.user, { status: "pending" });
        await owner.user.update({ status: "suspended" });
        // The suspended token is rejected outright on protected routes; on the
        // public listing it must not widen visibility.
        const res = await request(app).get(kind.list).set(owner.auth);
        assert.equal(res.status, 200);
        assert.ok(!ids(res, kind.key).includes(row.id));
      });
    });
  }

  test("an admin-created item is approved immediately", async () => {
    const admin = await makeUser({ role: "admin" });
    const res = await request(app).post("/api/jobs").set(admin.auth).send(jobPayload());
    assert.equal(res.body.job.status, "approved");
  });

  test("a company may close its own approved job without sending it back to review", async () => {
    const owner = await makeUser({ role: "company" });
    const job = await makeJob(owner.user, { status: "approved" });
    const res = await request(app).patch(`/api/jobs/${job.id}`).set(owner.auth).send({ status: "closed" });
    assert.equal(res.status, 200);
    assert.equal((await job.reload()).status, "closed");
  });

  test("a company cannot reject or approve through the edit route", async () => {
    const owner = await makeUser({ role: "company" });
    const job = await makeJob(owner.user, { status: "pending" });
    assert.equal((await request(app).patch(`/api/jobs/${job.id}`).set(owner.auth).send({ status: "approved" })).status, 403);
  });
});
