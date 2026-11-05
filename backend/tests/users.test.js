const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, closeDb } = require("./helpers");

describe("users and self-service profile", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const patchMe = (auth, body) => request(app).patch("/api/users/me").set(auth).send(body);

  test("a user can edit their name and profile", async () => {
    const { user, auth } = await makeUser({ role: "student" });
    const res = await patchMe(auth, { name: "New Name", studentProfile: { university: "UDSM", skills: ["js"] } });
    assert.equal(res.status, 200);
    await user.reload();
    assert.equal(user.name, "New Name");
    assert.equal(user.studentProfile.university, "UDSM");
  });

  test("a user cannot promote, unsuspend, re-email or re-password themselves through their profile", async () => {
    const { user, auth } = await makeUser({ role: "student", emailVerified: false });
    const before = { email: user.email, password: user.password };
    const res = await patchMe(auth, {
      name: "Still Me",
      role: "admin",
      status: "suspended",
      email: "attacker@example.com",
      password: "hacked-password-1",
      emailVerified: true,
      phoneVerified: true,
      id: "00000000-0000-4000-8000-000000000000"
    });
    assert.equal(res.status, 200);
    await user.reload();
    assert.equal(user.role, "student");
    assert.equal(user.status, "active");
    assert.equal(user.email, before.email);
    assert.equal(user.password, before.password);
    assert.equal(user.emailVerified, false, "verification cannot be self-granted");
    assert.equal(user.phoneVerified, false);
    assert.equal(res.body.user.role, "student");
  });

  test("only recognised theme preferences are stored", async () => {
    const { user, auth } = await makeUser();
    await patchMe(auth, { preferences: { theme: "forest", evil: "x".repeat(50) } });
    await user.reload();
    assert.deepEqual(user.preferences, { theme: "forest" });
    await patchMe(auth, { preferences: { theme: "not-a-theme" } });
    assert.equal((await user.reload()).preferences.theme, "forest");
  });

  test("changing the phone number clears its verification", async () => {
    const { user, auth } = await makeUser();
    await user.update({ phone: "+255700000001", phoneVerified: true });

    await patchMe(auth, { name: "Same Phone", phone: "+255700000001" });
    assert.equal((await user.reload()).phoneVerified, true, "re-sending the same number must not reset it");

    await patchMe(auth, { phone: "+255700000002" });
    assert.equal((await user.reload()).phoneVerified, false, "a new number is unverified");
  });

  test("no response ever contains a password hash", async () => {
    const admin = await makeUser({ role: "admin" });
    const other = await makeUser({ role: "student" });
    const responses = [
      await request(app).get("/api/auth/me").set(other.auth),
      await patchMe(other.auth, { name: "Changed" }),
      await request(app).get("/api/users").set(admin.auth),
      await request(app).patch(`/api/users/${other.user.id}/status`).set(admin.auth).send({ status: "suspended" }),
      await request(app).patch(`/api/users/${other.user.id}/role`).set(admin.auth).send({ role: "mentor" })
    ];
    for (const res of responses) {
      assert.equal(res.status, 200);
      const text = JSON.stringify(res.body);
      assert.ok(!/"password"/.test(text), "password field present");
      assert.ok(!text.includes("$2a$") && !text.includes("$2b$"), "bcrypt hash present");
    }
  });

  test("an admin cannot suspend or change the role of their own account", async () => {
    const admin = await makeUser({ role: "admin" });
    const status = await request(app).patch(`/api/users/${admin.user.id}/status`).set(admin.auth).send({ status: "suspended" });
    const role = await request(app).patch(`/api/users/${admin.user.id}/role`).set(admin.auth).send({ role: "student" });
    assert.equal(status.status, 400);
    assert.equal(role.status, 400);
    assert.equal((await admin.user.reload()).role, "admin");
  });

  test("suspending a user takes effect on their very next request", async () => {
    const admin = await makeUser({ role: "admin" });
    const victim = await makeUser({ role: "student" });
    assert.equal((await request(app).get("/api/auth/me").set(victim.auth)).status, 200);
    await request(app).patch(`/api/users/${victim.user.id}/status`).set(admin.auth).send({ status: "suspended" });
    assert.equal((await request(app).get("/api/auth/me").set(victim.auth)).status, 401);
    const login = await request(app).post("/api/auth/login").set("X-Forwarded-For", "10.200.0.1").send({ email: victim.user.email, password: "password-123" });
    assert.equal(login.status, 403);
  });

  test("an invalid role or status value is rejected", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser({ role: "student" });
    assert.equal((await request(app).patch(`/api/users/${target.user.id}/role`).set(admin.auth).send({ role: "superuser" })).status, 400);
    assert.equal((await request(app).patch(`/api/users/${target.user.id}/status`).set(admin.auth).send({ status: "banned" })).status, 400);
  });

  test("the admin user list can be filtered and searched", async () => {
    const admin = await makeUser({ role: "admin" });
    await makeUser({ role: "mentor" });
    await makeUser({ role: "company" });
    const mentors = await request(app).get("/api/users?role=mentor").set(admin.auth);
    assert.equal(mentors.body.users.length, 1);
    assert.equal(mentors.body.users[0].role, "mentor");
    const search = await request(app).get("/api/users?q=company").set(admin.auth);
    assert.ok(search.body.users.every((u) => /company/i.test(u.name + u.email)));
  });
});
