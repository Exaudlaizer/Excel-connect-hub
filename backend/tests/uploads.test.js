const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { hasDb, load, resetDb, makeUser, closeDb } = require("./helpers");

// 1x1 transparent PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe("image uploads", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app;
  const dir = process.env.UPLOAD_DIR;
  before(() => ({ request, app } = load()));
  beforeEach(async () => {
    // Each test starts with an empty upload directory.
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await resetDb();
  });
  after(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeDb();
  });

  const upload = (auth, buffer, filename, contentType) => {
    const req = request(app).post("/api/uploads");
    if (auth) req.set(auth);
    return buffer ? req.attach("file", buffer, { filename, contentType }) : req;
  };
  const stored = () => fs.readdirSync(dir);

  test("a valid image is stored under a generated name and served read-only", async () => {
    const { auth } = await makeUser({ role: "company" });
    const res = await upload(auth, PNG, "logo.png", "image/png");
    assert.equal(res.status, 201);
    assert.match(res.body.filename, /^\d+-[0-9a-f]{16}\.png$/);
    assert.ok(fs.existsSync(path.join(dir, res.body.filename)));

    const served = await request(app).get(`/uploads/${res.body.filename}`);
    assert.equal(served.status, 200);
    assert.match(served.headers["content-type"], /image\/png/);
    assert.equal(served.headers["x-content-type-options"], "nosniff");
  });

  test("the client's filename never decides the stored name or location", async () => {
    const { auth } = await makeUser({ role: "student" });
    const res = await upload(auth, PNG, "../../../server.js.html", "image/png");
    assert.equal(res.status, 201);
    assert.match(res.body.filename, /^\d+-[0-9a-f]{16}\.png$/);
    assert.deepEqual(stored(), [res.body.filename], "exactly one file, inside the upload directory");
    assert.ok(!fs.existsSync(path.join(dir, "..", "server.js.html")));
  });

  test("SVG and other non-image types are refused and nothing is written", async () => {
    const { auth } = await makeUser({ role: "student" });
    const cases = [
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "x.svg", "image/svg+xml"],
      [Buffer.from("<html><script>alert(1)</script></html>"), "x.html", "text/html"],
      [Buffer.from("MZ"), "x.exe", "application/octet-stream"],
      [Buffer.from("%PDF-1.4"), "x.pdf", "application/pdf"]
    ];
    for (const [buffer, name, type] of cases) {
      const res = await upload(auth, buffer, name, type);
      assert.equal(res.status, 400, `${type} should be refused`);
    }
    assert.deepEqual(stored(), []);
  });

  test("a file over 4 MB is refused with 413", async () => {
    const { auth } = await makeUser({ role: "student" });
    const big = Buffer.alloc(4 * 1024 * 1024 + 1024, 1);
    const res = await upload(auth, big, "big.png", "image/png");
    assert.equal(res.status, 413);
    assert.deepEqual(stored(), []);
  });

  test("a request with no file is refused", async () => {
    const { auth } = await makeUser({ role: "student" });
    assert.equal((await upload(auth)).status, 400);
  });

  test("anonymous and unverified callers cannot upload", async () => {
    assert.equal((await upload(null, PNG, "a.png", "image/png")).status, 401);
    const { auth } = await makeUser({ role: "student", emailVerified: false });
    const res = await upload(auth, PNG, "a.png", "image/png");
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "EMAIL_NOT_VERIFIED");
    assert.deepEqual(stored(), []);
  });

  test("only an admin can delete, and only files the server generated", async () => {
    const student = await makeUser({ role: "student" });
    const admin = await makeUser({ role: "admin" });
    const { body } = await upload(student.auth, PNG, "a.png", "image/png");

    assert.equal((await request(app).delete(`/api/uploads/${body.filename}`).set(student.auth)).status, 403);
    assert.equal((await request(app).delete("/api/uploads/server.js").set(admin.auth)).status, 400, "not a generated name");
    assert.equal((await request(app).delete("/api/uploads/1-0000000000000000.png").set(admin.auth)).status, 404);
    assert.equal((await request(app).delete(`/api/uploads/${body.filename}`).set(admin.auth)).status, 200);
    assert.deepEqual(stored(), []);
  });
});
