const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, closeDb } = require("./helpers");

describe("community", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const post = (auth, body = {}) =>
    request(app).post("/api/community").set(auth).send({ title: "Study group for databases", body: "Anyone want to meet on Thursdays to revise?", ...body });
  const reply = (auth, id, body = "Count me in, thanks!") => request(app).post(`/api/community/${id}/replies`).set(auth).send({ body });

  test("anyone can read the feed and a thread; authors show only id, name and role", async () => {
    const author = await makeUser({ role: "student" });
    const created = await post(author.auth);
    await reply(author.auth, created.body.post.id);

    const feed = await request(app).get("/api/community");
    assert.equal(feed.status, 200);
    assert.equal(feed.body.posts[0].replyCount, 1);

    const thread = await request(app).get(`/api/community/${created.body.post.id}`);
    assert.equal(thread.body.post.replies.length, 1);

    const text = JSON.stringify([feed.body, thread.body]);
    assert.ok(!text.includes(author.user.email), "the author's email must not be public");
    // `_id` is an alias of `id` that User.toJSON adds for the frontend.
    const allowed = new Set(["id", "_id", "name", "role"]);
    for (const key of Object.keys(thread.body.post.author)) assert.ok(allowed.has(key), `author exposes unexpected field "${key}"`);
  });

  test("only an admin can post an announcement", async () => {
    const student = await makeUser({ role: "student" });
    const admin = await makeUser({ role: "admin" });
    assert.equal((await post(student.auth, { category: "announcement" })).status, 403);
    assert.equal((await post(admin.auth, { category: "announcement" })).status, 201);
  });

  test("pinning is an admin action; a pinned flag in a normal post is ignored", async () => {
    const student = await makeUser({ role: "student" });
    const admin = await makeUser({ role: "admin" });
    const created = await post(student.auth, { pinned: true });
    assert.equal(created.body.post.pinned, false);

    assert.equal((await request(app).patch(`/api/community/${created.body.post.id}/pin`).set(student.auth).send({ pinned: true })).status, 403);
    const pinned = await request(app).patch(`/api/community/${created.body.post.id}/pin`).set(admin.auth).send({ pinned: true });
    assert.equal(pinned.body.post.pinned, true);
  });

  test("pinned posts come first in the feed", async () => {
    const admin = await makeUser({ role: "admin" });
    const student = await makeUser({ role: "student" });
    const older = await post(admin.auth, { title: "Pinned older post", pinned: true });
    await post(student.auth, { title: "Newer ordinary post" });
    const feed = await request(app).get("/api/community");
    assert.equal(feed.body.posts[0].id, older.body.post.id);
  });

  test("authors and admins can delete a post; other members cannot", async () => {
    const author = await makeUser({ role: "student" });
    const other = await makeUser({ role: "student" });
    const admin = await makeUser({ role: "admin" });
    const a = (await post(author.auth)).body.post.id;
    const b = (await post(author.auth)).body.post.id;

    assert.equal((await request(app).delete(`/api/community/${a}`).set(other.auth)).status, 403);
    assert.equal((await request(app).delete(`/api/community/${a}`).set(author.auth)).status, 200);
    assert.equal((await request(app).delete(`/api/community/${b}`).set(admin.auth)).status, 200);
    assert.equal(await models.CommunityPost.count(), 0);
  });

  test("deleting a post removes its replies", async () => {
    const author = await makeUser({ role: "student" });
    const id = (await post(author.auth)).body.post.id;
    await reply(author.auth, id);
    await request(app).delete(`/api/community/${id}`).set(author.auth);
    assert.equal(await models.CommunityReply.count(), 0);
  });

  test("replies: only the author or an admin can delete one", async () => {
    const author = await makeUser({ role: "student" });
    const other = await makeUser({ role: "mentor" });
    const admin = await makeUser({ role: "admin" });
    const id = (await post(author.auth)).body.post.id;
    const r1 = (await reply(other.auth, id)).body.reply.id;
    const r2 = (await reply(other.auth, id)).body.reply.id;

    assert.equal((await request(app).delete(`/api/community/${id}/replies/${r1}`).set(author.auth)).status, 403, "the post's author is not the reply's author");
    assert.equal((await request(app).delete(`/api/community/${id}/replies/${r1}`).set(other.auth)).status, 200);
    assert.equal((await request(app).delete(`/api/community/${id}/replies/${r2}`).set(admin.auth)).status, 200);
  });

  test("replying to a missing post is a 404; empty content is rejected", async () => {
    const student = await makeUser({ role: "student" });
    assert.equal((await reply(student.auth, "00000000-0000-4000-8000-000000000000")).status, 404);
    assert.equal((await post(student.auth, { title: "no", body: "short" })).status, 400);
    const id = (await post(student.auth)).body.post.id;
    assert.equal((await reply(student.auth, id, "")).status, 400);
  });
});
