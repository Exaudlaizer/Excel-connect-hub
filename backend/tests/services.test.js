const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, closeDb } = require("./helpers");

describe("campus services directory", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const payload = (overrides = {}) => ({
    name: "Career counselling desk",
    description: "Free one-to-one CV and interview coaching for students.",
    category: "career",
    ...overrides
  });

  test("an admin can create, edit and remove entries; nobody else can", async () => {
    const admin = await makeUser({ role: "admin" });
    const student = await makeUser({ role: "student" });

    assert.equal((await request(app).post("/api/services").set(student.auth).send(payload())).status, 403);
    const created = await request(app).post("/api/services").set(admin.auth).send(payload());
    assert.equal(created.status, 201);
    const id = created.body.service.id;
    assert.equal(created.body.service.createdById, admin.user.id);

    assert.equal((await request(app).patch(`/api/services/${id}`).set(student.auth).send(payload({ name: "Hijacked" }))).status, 403);
    const edited = await request(app).patch(`/api/services/${id}`).set(admin.auth).send(payload({ name: "Careers desk" }));
    assert.equal(edited.body.service.name, "Careers desk");

    assert.equal((await request(app).delete(`/api/services/${id}`).set(student.auth)).status, 403);
    assert.equal((await request(app).delete(`/api/services/${id}`).set(admin.auth)).status, 200);
    assert.equal(await models.Service.count(), 0);
  });

  test("everyone sees active entries; archived ones are for admins only", async () => {
    const admin = await makeUser({ role: "admin" });
    const student = await makeUser({ role: "student" });
    await request(app).post("/api/services").set(admin.auth).send(payload({ name: "Visible service" }));
    await request(app).post("/api/services").set(admin.auth).send(payload({ name: "Retired service", status: "archived" }));

    const names = (res) => res.body.services.map((s) => s.name);
    assert.deepEqual(names(await request(app).get("/api/services")), ["Visible service"]);
    assert.deepEqual(names(await request(app).get("/api/services").set(student.auth)), ["Visible service"]);
    assert.deepEqual(names(await request(app).get("/api/services?status=archived").set(student.auth)), ["Visible service"], "a student cannot ask for archived entries");
    assert.deepEqual(names(await request(app).get("/api/services?status=archived").set(admin.auth)), ["Retired service"]);
  });

  test("the list can be filtered by category", async () => {
    const admin = await makeUser({ role: "admin" });
    await request(app).post("/api/services").set(admin.auth).send(payload({ name: "Career help", category: "career" }));
    await request(app).post("/api/services").set(admin.auth).send(payload({ name: "Housing help", category: "housing" }));
    const res = await request(app).get("/api/services?category=housing");
    assert.deepEqual(res.body.services.map((s) => s.name), ["Housing help"]);
  });

  test("bad input is rejected and a missing entry is a 404", async () => {
    const admin = await makeUser({ role: "admin" });
    const post = (body) => request(app).post("/api/services").set(admin.auth).send(body);
    assert.equal((await post(payload({ name: "ab" }))).status, 400);
    assert.equal((await post(payload({ description: "short" }))).status, 400);
    assert.equal((await post(payload({ category: "nonsense" }))).status, 400);
    assert.equal((await post(payload({ contactEmail: "not-an-email" }))).status, 400);
    assert.equal((await post(payload({ url: "javascript:alert(1)" }))).status, 400, "script URLs must not be accepted");

    const missing = "00000000-0000-4000-8000-000000000000";
    assert.equal((await request(app).patch(`/api/services/${missing}`).set(admin.auth).send(payload({ name: "Nothing here" }))).status, 404);
    assert.equal((await request(app).delete(`/api/services/${missing}`).set(admin.auth)).status, 404);
  });
});
