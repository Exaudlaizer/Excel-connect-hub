const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, makeCourse, coursePayload, closeDb } = require("./helpers");

describe("courses and enrolment", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const enroll = (auth, id) => request(app).post(`/api/courses/${id}/enroll`).set(auth).send({});

  test("a student can enrol in an approved course, once", async () => {
    const mentor = await makeUser({ role: "mentor" });
    const student = await makeUser({ role: "student" });
    const course = await makeCourse(mentor.user);

    assert.equal((await enroll(student.auth, course.id)).status, 200);
    const again = await enroll(student.auth, course.id);
    assert.equal(again.status, 200);
    assert.equal(again.body.alreadyEnrolled, true);
    assert.deepEqual((await course.reload()).enrolledStudents, [student.user.id], "enrolled exactly once");
  });

  test("two students enrolling at the same moment are both recorded", async () => {
    const mentor = await makeUser({ role: "mentor" });
    const a = await makeUser({ role: "student" });
    const b = await makeUser({ role: "student" });
    const course = await makeCourse(mentor.user);
    await Promise.all([enroll(a.auth, course.id), enroll(b.auth, course.id)]);
    assert.equal((await course.reload()).enrolledStudents.length, 2);
  });

  test("enrolment is refused for a course that is not approved", async () => {
    const mentor = await makeUser({ role: "mentor" });
    const student = await makeUser({ role: "student" });
    for (const status of ["pending", "rejected", "archived"]) {
      const course = await makeCourse(mentor.user, { status });
      assert.equal((await enroll(student.auth, course.id)).status, 404, status);
    }
  });

  test("only students can enrol", async () => {
    const mentor = await makeUser({ role: "mentor" });
    const course = await makeCourse(mentor.user);
    for (const role of ["company", "mentor", "admin"]) {
      const { auth } = await makeUser({ role });
      assert.equal((await enroll(auth, course.id)).status, 403, role);
    }
  });

  test("an enrolled student's id is never exposed in the public course list", async () => {
    const mentor = await makeUser({ role: "mentor" });
    const student = await makeUser({ role: "student" });
    const course = await makeCourse(mentor.user);
    await enroll(student.auth, course.id);

    for (const res of [
      await request(app).get("/api/courses"),
      await request(app).get("/api/courses").set((await makeUser({ role: "student" })).auth),
      await request(app).get("/api/courses").set(mentor.auth)
    ]) {
      assert.equal(res.status, 200);
      assert.ok(!JSON.stringify(res.body).includes(student.user.id), "a student's id leaked in the course list");
      assert.ok(!("enrolledStudents" in res.body.courses[0]), "the roster must not be sent");
    }
  });

  test("the enrol response reports the count and the caller's own state, not the roster", async () => {
    const mentor = await makeUser({ role: "mentor" });
    const student = await makeUser({ role: "student" });
    const other = await makeUser({ role: "student" });
    const course = await makeCourse(mentor.user);
    await enroll(other.auth, course.id);
    const res = await enroll(student.auth, course.id);
    assert.equal(res.body.course.enrolledCount, 2);
    assert.equal(res.body.course.isEnrolled, true);
    assert.ok(!JSON.stringify(res.body).includes(other.user.id));
  });

  test("a mentor cannot publish a course that already claims enrolments", async () => {
    const mentor = await makeUser({ role: "mentor" });
    const student = await makeUser({ role: "student" });
    const res = await request(app).post("/api/courses").set(mentor.auth).send({ ...coursePayload(), enrolledStudents: [student.user.id], status: "approved" });
    assert.equal(res.status, 201);
    assert.equal(res.body.course.status, "pending");
    const row = await models.Course.findByPk(res.body.course.id);
    assert.deepEqual(row.enrolledStudents || [], []);
  });

  test("responses to the owner and admin do not leak the roster either", async () => {
    const mentor = await makeUser({ role: "mentor" });
    const admin = await makeUser({ role: "admin" });
    const student = await makeUser({ role: "student" });
    const course = await makeCourse(mentor.user);
    await enroll(student.auth, course.id);

    const edited = await request(app).patch(`/api/courses/${course.id}`).set(mentor.auth).send({ title: "A new course title" });
    const approved = await request(app).patch(`/api/courses/${course.id}/approval`).set(admin.auth).send({ status: "approved" });
    for (const res of [edited, approved]) {
      assert.equal(res.status, 200);
      assert.ok(!JSON.stringify(res.body).includes(student.user.id), "roster leaked in a write response");
    }
  });
});
