const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, makeJob, closeDb } = require("./helpers");
const { readPagination, buildMeta, MAX_LIMIT, DEFAULT_LIMIT } = require("../src/utils/pagination");

describe("pagination helpers", () => {
  test("defaults, floors and clamps", () => {
    assert.deepEqual(readPagination({}), { page: 1, limit: DEFAULT_LIMIT, offset: 0 });
    assert.equal(readPagination({ limit: "100000" }).limit, MAX_LIMIT);
    assert.equal(readPagination({ page: "-3" }).page, 1);
    assert.equal(readPagination({ page: "0" }).page, 1);
    assert.equal(readPagination({ limit: "abc", page: "xyz" }).limit, DEFAULT_LIMIT);
    assert.deepEqual(readPagination({ page: "3", limit: "10" }), { page: 3, limit: 10, offset: 20 });
  });

  test("meta describes the page", () => {
    assert.deepEqual(buildMeta({ page: 1, limit: 10, total: 25 }), { page: 1, limit: 10, total: 25, pages: 3, hasMore: true });
    assert.deepEqual(buildMeta({ page: 3, limit: 10, total: 25 }), { page: 3, limit: 10, total: 25, pages: 3, hasMore: false });
    assert.equal(buildMeta({ page: 1, limit: 10, total: 0 }).pages, 1, "an empty list still has one page");
  });
});

describe("pagination on list endpoints", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app;
  before(() => ({ request, app } = load()));
  beforeEach(resetDb);
  after(closeDb);

  test("pages split the list without overlap and report totals", async () => {
    const company = await makeUser({ role: "company" });
    for (let i = 0; i < 5; i += 1) await makeJob(company.user, { title: `Opening number ${i + 1}` });

    const p1 = await request(app).get("/api/jobs?limit=2&page=1");
    const p2 = await request(app).get("/api/jobs?limit=2&page=2");
    const p3 = await request(app).get("/api/jobs?limit=2&page=3");
    assert.deepEqual([p1, p2, p3].map((r) => r.body.jobs.length), [2, 2, 1]);
    assert.equal(p1.body.pagination.total, 5);
    assert.equal(p1.body.pagination.pages, 3);
    assert.equal(p1.body.pagination.hasMore, true);
    assert.equal(p3.body.pagination.hasMore, false);

    const ids = [p1, p2, p3].flatMap((r) => r.body.jobs.map((j) => j.id));
    assert.equal(new Set(ids).size, 5, "no job appears twice across pages");
  });

  test("an enormous limit is clamped to the maximum", async () => {
    const res = await request(app).get("/api/jobs?limit=1000000");
    assert.equal(res.body.pagination.limit, MAX_LIMIT);
  });

  test("a page past the end is empty, not an error", async () => {
    const res = await request(app).get("/api/jobs?page=99");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.jobs, []);
  });
});
