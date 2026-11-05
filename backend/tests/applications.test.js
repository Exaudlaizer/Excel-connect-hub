const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, makeJob, closeDb } = require("./helpers");

describe("job applications", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const letter = "I am a final-year student and would love to join your team this year.";
  const apply = (auth, job, body = {}) => request(app).post("/api/applications").set(auth).send({ job, coverLetter: letter, ...body });

  test("a student can apply to an approved job", async () => {
    const company = await makeUser({ role: "company" });
    const student = await makeUser({ role: "student" });
    const job = await makeJob(company.user);
    const res = await apply(student.auth, job.id);
    assert.equal(res.status, 201);
    assert.equal(res.body.application.status, "submitted");
  });

  test("a second application to the same job is a conflict", async () => {
    const company = await makeUser({ role: "company" });
    const student = await makeUser({ role: "student" });
    const job = await makeJob(company.user);
    assert.equal((await apply(student.auth, job.id)).status, 201);
    assert.equal((await apply(student.auth, job.id)).status, 409);
    assert.equal(await models.Application.count(), 1);
  });

  test("applying to a job that is not approved looks like it does not exist", async () => {
    const company = await makeUser({ role: "company" });
    const student = await makeUser({ role: "student" });
    for (const status of ["pending", "rejected", "closed"]) {
      const job = await makeJob(company.user, { status });
      assert.equal((await apply(student.auth, job.id)).status, 404, status);
    }
  });

  test("a short cover letter and a malformed job id are rejected", async () => {
    const company = await makeUser({ role: "company" });
    const student = await makeUser({ role: "student" });
    const job = await makeJob(company.user);
    assert.equal((await apply(student.auth, job.id, { coverLetter: "too short" })).status, 400);
    assert.equal((await apply(student.auth, "not-a-uuid")).status, 400);
  });

  test("only students apply; a student sees only their own applications", async () => {
    const company = await makeUser({ role: "company" });
    const a = await makeUser({ role: "student" });
    const b = await makeUser({ role: "student" });
    const job = await makeJob(company.user);
    assert.equal((await apply(company.auth, job.id)).status, 403);
    await apply(a.auth, job.id);

    const mineA = await request(app).get("/api/applications/mine").set(a.auth);
    const mineB = await request(app).get("/api/applications/mine").set(b.auth);
    assert.equal(mineA.body.applications.length, 1);
    assert.equal(mineB.body.applications.length, 0);
  });

  test("a company sees applicants for its own jobs only", async () => {
    const owner = await makeUser({ role: "company" });
    const rival = await makeUser({ role: "company" });
    const student = await makeUser({ role: "student" });
    const job = await makeJob(owner.user);
    await apply(student.auth, job.id);

    const own = await request(app).get("/api/applications/applicants").set(owner.auth);
    const other = await request(app).get("/api/applications/applicants").set(rival.auth);
    assert.equal(own.body.applications.length, 1);
    assert.equal(other.body.applications.length, 0);
  });

  test("applicant data does not expose the student's password hash", async () => {
    const owner = await makeUser({ role: "company" });
    const student = await makeUser({ role: "student" });
    const job = await makeJob(owner.user);
    await apply(student.auth, job.id);
    const res = await request(app).get("/api/applications/applicants").set(owner.auth);
    const text = JSON.stringify(res.body);
    assert.ok(!/password/i.test(text), "no password field may appear");
    assert.ok(!text.includes("$2"), "no bcrypt hash may appear");
  });

  test("only the job's company (or an admin) can change an application's status, to a valid value", async () => {
    const owner = await makeUser({ role: "company" });
    const rival = await makeUser({ role: "company" });
    const admin = await makeUser({ role: "admin" });
    const student = await makeUser({ role: "student" });
    const job = await makeJob(owner.user);
    const id = (await apply(student.auth, job.id)).body.application.id;
    const setStatus = (auth, status) => request(app).patch(`/api/applications/${id}/status`).set(auth).send({ status });

    assert.equal((await setStatus(rival.auth, "hired")).status, 403, "a rival company");
    assert.equal((await setStatus(student.auth, "hired")).status, 403, "the student");
    assert.equal((await setStatus(owner.auth, "shortlisted")).status, 200);
    assert.equal((await setStatus(owner.auth, "bogus")).status, 400);
    assert.equal((await setStatus(admin.auth, "reviewing")).status, 200);
    assert.equal((await models.Application.findByPk(id)).status, "reviewing");
  });
});
