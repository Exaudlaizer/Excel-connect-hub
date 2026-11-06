const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, makeJob, makeAd, makeCourse, captureMail, extractResetToken, nextIp, closeDb } = require("./helpers");

describe("audit log", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const rows = (where = {}) => models.AuditLog.findAll({ where, order: [["createdAt", "ASC"]] });
  const one = async (action) => {
    const found = await rows({ action });
    assert.equal(found.length, 1, `expected exactly one "${action}" row, found ${found.length}`);
    return found[0];
  };

  describe("moderation decisions", () => {
    for (const kind of [
      { name: "job", action: "job.status", make: makeJob, ownerRole: "company", path: (id) => `/api/jobs/${id}/approval`, body: { status: "rejected" } },
      { name: "ad", action: "ad.status", make: makeAd, ownerRole: "company", path: (id) => `/api/ads/${id}/approval`, body: { status: "rejected" } },
      { name: "course", action: "course.status", make: makeCourse, ownerRole: "mentor", path: (id) => `/api/courses/${id}/approval`, body: { status: "rejected" } }
    ]) {
      test(`${kind.name} approval/rejection records who decided and what changed`, async () => {
        const admin = await makeUser({ role: "admin" });
        const owner = await makeUser({ role: kind.ownerRole });
        const item = await kind.make(owner.user, { status: "pending" });
        assert.equal((await request(app).patch(kind.path(item.id)).set(admin.auth).send(kind.body)).status, 200);

        const row = await one(kind.action);
        assert.equal(row.actorId, admin.user.id);
        assert.equal(row.actorEmail, admin.user.email);
        assert.equal(row.targetType, kind.name);
        assert.equal(row.targetId, item.id);
        assert.equal(row.details.from, "pending");
        assert.equal(row.details.to, "rejected");
      });

      test(`a refused ${kind.name} approval writes nothing`, async () => {
        const owner = await makeUser({ role: kind.ownerRole });
        const item = await kind.make(owner.user, { status: "pending" });
        assert.equal((await request(app).patch(kind.path(item.id)).set(owner.auth).send(kind.body)).status, 403);
        assert.equal(await models.AuditLog.count(), 0);
      });
    }
  });

  describe("accounts", () => {
    test("suspension and role changes are recorded with before and after", async () => {
      const admin = await makeUser({ role: "admin" });
      const target = await makeUser({ role: "student" });
      await request(app).patch(`/api/users/${target.user.id}/status`).set(admin.auth).send({ status: "suspended" });
      await request(app).patch(`/api/users/${target.user.id}/role`).set(admin.auth).send({ role: "mentor" });

      const status = await one("user.status");
      assert.deepEqual([status.details.from, status.details.to], ["active", "suspended"]);
      assert.equal(status.targetId, target.user.id);
      const role = await one("user.role");
      assert.deepEqual([role.details.from, role.details.to], ["student", "mentor"]);
    });

    test("'sign out everywhere' and a completed password reset are recorded", async () => {
      const { user, auth } = await makeUser();
      await request(app).post("/api/auth/logout-all").set(auth).send({});
      assert.equal((await one("auth.logout_all")).actorId, user.id);

      const { mail } = await captureMail(() => request(app).post("/api/auth/forgot-password").set("X-Forwarded-For", nextIp()).send({ email: user.email }));
      await request(app).post("/api/auth/reset-password").set("X-Forwarded-For", nextIp()).send({ token: extractResetToken(mail), password: "brand-new-pass-1" });
      const reset = await one("auth.password_reset");
      assert.equal(reset.actorId, user.id, "the person resetting is the actor even though they have no session");
    });
  });

  describe("moderation of other people's content", () => {
    test("an admin deleting or editing someone else's listing is recorded; an owner doing it to their own is not", async () => {
      const admin = await makeUser({ role: "admin" });
      const owner = await makeUser({ role: "company" });
      const mine = await makeJob(owner.user);
      const theirs = await makeJob(owner.user);

      await request(app).delete(`/api/jobs/${mine.id}`).set(owner.auth);
      assert.equal(await models.AuditLog.count(), 0, "owners deleting their own listing is not an admin action");

      await request(app).patch(`/api/jobs/${theirs.id}`).set(admin.auth).send({ title: "Edited by staff" });
      await request(app).delete(`/api/jobs/${theirs.id}`).set(admin.auth);
      assert.equal((await one("job.update")).details.ownerId, owner.user.id);
      assert.equal((await one("job.delete")).targetId, theirs.id);
    });

    test("community moderation: pinning, and deleting another member's post or reply", async () => {
      const admin = await makeUser({ role: "admin" });
      const member = await makeUser({ role: "student" });
      const post = await models.CommunityPost.create({ authorId: member.user.id, title: "A member's post", body: "Some content for the thread.", category: "discussion" });
      const reply = await models.CommunityReply.create({ postId: post.id, authorId: member.user.id, body: "A reply." });

      await request(app).patch(`/api/community/${post.id}/pin`).set(admin.auth).send({ pinned: true });
      await request(app).delete(`/api/community/${post.id}/replies/${reply.id}`).set(admin.auth);
      await request(app).delete(`/api/community/${post.id}`).set(admin.auth);
      assert.equal((await one("community.pin")).details.pinned, true);
      assert.equal((await one("community.reply.delete")).details.authorId, member.user.id);
      assert.equal((await one("community.post.delete")).targetId, post.id);
    });

    test("services directory changes are recorded", async () => {
      const admin = await makeUser({ role: "admin" });
      const body = { name: "Careers desk", description: "Free coaching for students.", category: "career" };
      const created = await request(app).post("/api/services").set(admin.auth).send(body);
      await request(app).patch(`/api/services/${created.body.service.id}`).set(admin.auth).send({ ...body, name: "Careers office" });
      await request(app).delete(`/api/services/${created.body.service.id}`).set(admin.auth);
      for (const action of ["service.create", "service.update", "service.delete"]) await one(action);
    });
  });

  describe("what is and is not stored", () => {
    test("rows never contain tokens, passwords or request bodies", async () => {
      const admin = await makeUser({ role: "admin" });
      const target = await makeUser({ role: "student" });
      await request(app).patch(`/api/users/${target.user.id}/status`).set(admin.auth).send({ status: "suspended", password: "should-not-be-stored-1" });
      const text = JSON.stringify((await rows()).map((r) => r.toJSON()));
      assert.ok(!text.includes("should-not-be-stored-1"));
      assert.ok(!text.includes("Bearer"));
      assert.ok(!text.includes(String(admin.auth.Authorization).slice(-20)));
    });

    test("a failure to write the trail never fails the action", async () => {
      const admin = await makeUser({ role: "admin" });
      const owner = await makeUser({ role: "company" });
      const job = await makeJob(owner.user, { status: "pending" });

      const original = models.AuditLog.create;
      const originalError = console.error;
      console.error = () => {};
      models.AuditLog.create = async () => {
        throw new Error("audit table unavailable");
      };
      try {
        const res = await request(app).patch(`/api/jobs/${job.id}/approval`).set(admin.auth).send({ status: "approved" });
        assert.equal(res.status, 200, "the moderation decision must still succeed");
      } finally {
        models.AuditLog.create = original;
        console.error = originalError;
      }
      assert.equal((await job.reload()).status, "approved");
    });

    test("deleting an account keeps its trail, with the email snapshot", async () => {
      const admin = await makeUser({ role: "admin" });
      const target = await makeUser({ role: "student" });
      await request(app).patch(`/api/users/${target.user.id}/status`).set(admin.auth).send({ status: "suspended" });
      await admin.user.destroy();
      const row = await one("user.status");
      assert.equal(row.actorId, null);
      assert.equal(row.actorEmail, admin.user.email);
    });
  });

  describe("GET /api/admin/audit", () => {
    test("is for admins only", async () => {
      const student = await makeUser({ role: "student" });
      assert.equal((await request(app).get("/api/admin/audit").set(student.auth)).status, 403);
      assert.equal((await request(app).get("/api/admin/audit")).status, 401);
    });

    test("lists newest first, paginates and filters", async () => {
      const admin = await makeUser({ role: "admin" });
      const a = await makeUser({ role: "student" });
      const b = await makeUser({ role: "student" });
      await request(app).patch(`/api/users/${a.user.id}/status`).set(admin.auth).send({ status: "suspended" });
      await request(app).patch(`/api/users/${b.user.id}/role`).set(admin.auth).send({ role: "mentor" });

      const all = await request(app).get("/api/admin/audit").set(admin.auth);
      assert.equal(all.status, 200);
      assert.deepEqual(all.body.logs.map((l) => l.action), ["user.role", "user.status"]);
      assert.equal(all.body.pagination.total, 2);

      const onlyStatus = await request(app).get("/api/admin/audit?action=user.status").set(admin.auth);
      assert.deepEqual(onlyStatus.body.logs.map((l) => l.targetId), [a.user.id]);

      const byTarget = await request(app).get(`/api/admin/audit?targetType=user&targetId=${b.user.id}`).set(admin.auth);
      assert.equal(byTarget.body.logs.length, 1);

      const page = await request(app).get("/api/admin/audit?limit=1&page=2").set(admin.auth);
      assert.equal(page.body.logs.length, 1);
      assert.equal(page.body.pagination.hasMore, false);
    });

    test("a malformed filter is a client error, not a crash", async () => {
      const admin = await makeUser({ role: "admin" });
      const res = await request(app).get("/api/admin/audit?actorId=not-a-uuid").set(admin.auth);
      assert.equal(res.status, 400);
    });
  });
});
