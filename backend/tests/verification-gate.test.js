const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, closeDb } = require("./helpers");

// Publishing needs a verified email. Browsing, applying, enrolling and the
// verification endpoints themselves must stay open, or an unverified user could
// never get verified.
const FAKE = "00000000-0000-4000-8000-000000000000";
const ALL = ["student", "company", "mentor", "admin"];

const GATED = [
  ["POST", "/api/jobs", ["company", "admin"]],
  ["PATCH", `/api/jobs/${FAKE}`, ["company", "admin"]],
  ["POST", "/api/ads", ALL],
  ["PATCH", `/api/ads/${FAKE}`, ALL],
  ["POST", "/api/courses", ["mentor", "admin"]],
  ["PATCH", `/api/courses/${FAKE}`, ["mentor", "admin"]],
  ["POST", "/api/community", ALL],
  ["POST", `/api/community/${FAKE}/replies`, ALL],
  ["POST", "/api/uploads", ALL]
];

describe("email-verification gate", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app;
  before(() => ({ request, app } = load()));
  beforeEach(resetDb);
  after(closeDb);

  for (const [method, path, roles] of GATED) {
    test(`${method} ${path.replace(FAKE, ":id")} blocks unverified ${roles.join(", ")}`, async () => {
      for (const role of roles) {
        const { auth } = await makeUser({ role, emailVerified: false });
        const res = await request(app)[method.toLowerCase()](path).set(auth).send({});
        assert.equal(res.status, 403, `${role} should be blocked`);
        assert.equal(res.body.code, "EMAIL_NOT_VERIFIED", `${role} should get the verification code`);
      }
    });

    test(`${method} ${path.replace(FAKE, ":id")} lets verified ${roles.join(", ")} through the gate`, async () => {
      for (const role of roles) {
        const { auth } = await makeUser({ role, emailVerified: true });
        const res = await request(app)[method.toLowerCase()](path).set(auth).send({});
        assert.notEqual(res.body.code, "EMAIL_NOT_VERIFIED", `${role} was wrongly gated`);
        assert.notEqual(res.status, 403, `${role} was refused with ${res.status}`);
      }
    });
  }

  test("an unverified account can still browse, apply, enrol and ask for a code", async () => {
    const student = await makeUser({ role: "student", emailVerified: false });
    const calls = [
      request(app).get("/api/jobs").set(student.auth),
      request(app).get("/api/courses").set(student.auth),
      request(app).get("/api/auth/me").set(student.auth),
      request(app).post("/api/applications").set(student.auth).send({}), // 400 validation, not a gate
      request(app).post(`/api/courses/${FAKE}/enroll`).set(student.auth).send({}), // 404, not a gate
      request(app).post("/api/auth/verification/request").set(student.auth).send({})
    ];
    for (const res of await Promise.all(calls)) {
      assert.notEqual(res.body.code, "EMAIL_NOT_VERIFIED");
      assert.notEqual(res.status, 403);
    }
  });

  test("an unverified admin can still moderate and reach verification", async () => {
    const admin = await makeUser({ role: "admin", emailVerified: false });
    assert.equal((await request(app).get("/api/admin/analytics").set(admin.auth)).status, 200);
    assert.equal((await request(app).get("/api/users").set(admin.auth)).status, 200);
    assert.equal((await request(app).patch(`/api/jobs/${FAKE}/approval`).set(admin.auth).send({ status: "approved" })).status, 404);
    assert.equal((await request(app).post("/api/services").set(admin.auth).send({})).status, 400); // validation, not the gate
    assert.equal((await request(app).post("/api/auth/verification/request").set(admin.auth).send({})).status, 200);
  });
});
