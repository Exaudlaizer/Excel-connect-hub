const { test, describe, before, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { hasDb, load, resetDb, makeUser, makeAd, closeDb, waitFor } = require("./helpers");

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from("JFIF\0"), Buffer.alloc(16)]);
const GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.from([1, 0, 1, 0]), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]);
const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypavif"), Buffer.alloc(4), Buffer.from("avifmif1"), Buffer.alloc(8)]);

const SB = { SUPABASE_URL: "https://abcdefgh.supabase.co", SUPABASE_BUCKET: "media", SUPABASE_SECRET_KEY: "sb_secret_TOPSECRETVALUE123456789" };

describe("uploads: content checks and storage drivers", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app;
  const dir = process.env.UPLOAD_DIR;
  const saved = {};
  const realFetch = global.fetch;
  let calls;

  const setEnv = (vars) => {
    for (const [k, v] of Object.entries(vars)) {
      if (!(k in saved)) saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  // Stands in for Supabase's server: records every request and answers as told.
  const fakeSupabase = (status = 200) => {
    calls = [];
    global.fetch = async (url, init) => {
      calls.push({ url: String(url), method: init?.method, headers: init?.headers, body: init?.body });
      return { ok: status >= 200 && status < 300, status, json: async () => (status === 200 ? { Key: "media/x" } : { statusCode: String(status), error: "Internal", message: "storage exploded", code: "x" }) };
    };
  };
  const useSupabase = () => setEnv({ STORAGE_DRIVER: "supabase", ...SB });
  const stored = () => fs.readdirSync(dir);

  before(() => ({ request, app } = load()));
  beforeEach(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await resetDb();
    setEnv({ STORAGE_DRIVER: undefined });
  });
  afterEach(() => {
    global.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
      delete saved[k];
    }
  });
  after(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeDb();
  });

  const upload = (auth, buffer, filename, contentType) => request(app).post("/api/uploads").set(auth).attach("file", buffer, { filename, contentType });

  describe("what the file really is decides, not what it is called", () => {
    test("a script labelled image/png is refused and nothing is stored", async () => {
      const { auth } = await makeUser();
      for (const [body, type] of [
        [Buffer.from("<html><script>alert(document.cookie)</script></html>"), "image/png"],
        [Buffer.from("<?php system($_GET['c']); ?>"), "image/jpeg"],
        [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "image/webp"],
        [Buffer.from("MZ\x90\x00 pretend executable ........"), "image/gif"]
      ]) {
        const res = await upload(auth, body, "photo.png", type);
        assert.equal(res.status, 400, `${type} should be refused`);
        assert.match(res.body.message, /not a valid image/);
      }
      assert.deepEqual(stored(), []);
    });

    test("an image whose label disagrees with its bytes is refused", async () => {
      const { auth } = await makeUser();
      const res = await upload(auth, PNG, "photo.jpg", "image/jpeg");
      assert.equal(res.status, 400);
      assert.deepEqual(stored(), []);
    });

    test("every accepted format is stored with the extension of its REAL type", async () => {
      const { auth } = await makeUser();
      const cases = [[PNG, "image/png", ".png"], [JPEG, "image/jpeg", ".jpg"], [GIF, "image/gif", ".gif"], [WEBP, "image/webp", ".webp"], [AVIF, "image/avif", ".avif"]];
      for (const [buffer, type, ext] of cases) {
        // The filename lies about the extension; the stored name must not.
        const res = await upload(auth, buffer, "totally-a-document.pdf", type);
        assert.equal(res.status, 201, type);
        assert.ok(res.body.filename.endsWith(ext), `${type} stored as ${res.body.filename}`);
      }
      assert.equal(stored().length, 5);
    });

    test("an image is served back with its own type and nosniff", async () => {
      const { auth } = await makeUser();
      const { body } = await upload(auth, JPEG, "x.jpg", "image/jpeg");
      const served = await request(app).get(`/uploads/${body.filename}`);
      assert.match(served.headers["content-type"], /image\/jpeg/);
      assert.equal(served.headers["x-content-type-options"], "nosniff");
    });
  });

  describe("STORAGE_DRIVER=supabase", () => {
    test("the image is sent to Supabase as the documentation describes, and nothing touches local disk", async () => {
      useSupabase();
      fakeSupabase(200);
      const { auth } = await makeUser();
      const res = await upload(auth, PNG, "logo.png", "image/png");

      assert.equal(res.status, 201);
      assert.match(res.body.url, /^https:\/\/abcdefgh\.supabase\.co\/storage\/v1\/object\/public\/media\/\d+-[0-9a-f]{16}\.png$/);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, "POST");
      assert.equal(calls[0].url, `https://abcdefgh.supabase.co/storage/v1/object/media/${res.body.filename}`);
      assert.equal(calls[0].headers["Content-Type"], "image/png");
      assert.equal(calls[0].headers.apikey, SB.SUPABASE_SECRET_KEY);
      assert.equal(calls[0].headers.Authorization, undefined);
      assert.ok(Buffer.compare(calls[0].body, PNG) === 0, "the exact bytes were sent");
      assert.deepEqual(stored(), []);
    });

    test("the secret key is never in any response", async () => {
      useSupabase();
      fakeSupabase(200);
      const { auth } = await makeUser();
      const res = await upload(auth, PNG, "logo.png", "image/png");
      assert.ok(!JSON.stringify([res.body, res.headers]).includes(SB.SUPABASE_SECRET_KEY));
    });

    test("if Supabase fails the user gets a calm 502 with no internals, and the log has no secret", async () => {
      useSupabase();
      fakeSupabase(500);
      const { auth } = await makeUser();
      const lines = [];
      const original = console.error;
      console.error = (line) => lines.push(String(line));
      let res;
      try {
        res = await upload(auth, PNG, "logo.png", "image/png");
      } finally {
        console.error = original;
      }
      assert.equal(res.status, 502);
      assert.match(res.body.message, /could not save that image/i);
      assert.ok(!JSON.stringify(res.body).match(/supabase|storage exploded|500/i));
      const logged = lines.join("\n");
      assert.match(logged, /image could not be stored/);
      assert.match(logged, /upload failed \(500\)/);
      assert.ok(!logged.includes(SB.SUPABASE_SECRET_KEY));
    });

    test("a content check still happens before anything is sent", async () => {
      useSupabase();
      fakeSupabase(200);
      const { auth } = await makeUser();
      const res = await upload(auth, Buffer.from("<script>alert(1)</script>"), "x.png", "image/png");
      assert.equal(res.status, 400);
      assert.equal(calls.length, 0);
    });

    test("deleting an ad removes its images from whichever store holds each one", async () => {
      useSupabase();
      fakeSupabase(200);
      const { user, auth } = await makeUser({ role: "company" });
      // One image in Supabase, one left over on local disk from before the switch,
      // and one hosted by someone else entirely.
      const remote = "1793879819388-50cdc283e8d38a30.png";
      const onDisk = "1793879819999-aaaaaaaaaaaaaaaa.png";
      fs.writeFileSync(path.join(dir, onDisk), PNG);
      const ad = await makeAd(user, {
        imageUrl: `https://abcdefgh.supabase.co/storage/v1/object/public/media/${remote}`,
        logoUrl: `http://localhost:5000/uploads/${onDisk}`
      });
      const foreign = await makeAd(user, { imageUrl: "https://cdn.example.com/their-photo.png", logoUrl: null });

      assert.equal((await request(app).delete(`/api/ads/${ad.id}`).set(auth)).status, 200);
      // Cleanup is fire-and-forget, so wait for it rather than guess how long it takes.
      assert.ok(await waitFor(() => calls.length >= 1 && stored().length === 0), "cleanup did not finish");
      assert.deepEqual(calls.map((c) => [c.method, c.url]), [["DELETE", `https://abcdefgh.supabase.co/storage/v1/object/media/${remote}`]]);
      assert.deepEqual(stored(), [], "the local leftover was deleted too");

      calls.length = 0;
      assert.equal((await request(app).delete(`/api/ads/${foreign.id}`).set(auth)).status, 200);
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(calls.length, 0, "someone else's image is never touched");
    });

    test("a storage failure while cleaning up never fails the deletion", async () => {
      useSupabase();
      fakeSupabase(500);
      const { user, auth } = await makeUser({ role: "company" });
      const ad = await makeAd(user, { imageUrl: "https://abcdefgh.supabase.co/storage/v1/object/public/media/1793879819388-50cdc283e8d38a30.png", logoUrl: null });
      const original = console.error;
      console.error = () => {};
      try {
        assert.equal((await request(app).delete(`/api/ads/${ad.id}`).set(auth)).status, 200);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        console.error = original;
      }
    });

    test("an admin can delete by filename through the active store", async () => {
      useSupabase();
      fakeSupabase(200);
      const admin = await makeUser({ role: "admin" });
      const res = await request(app).delete("/api/uploads/1793879819388-50cdc283e8d38a30.png").set(admin.auth);
      assert.equal(res.status, 200);
      assert.equal(calls[0].method, "DELETE");
    });

    test("a half-configured driver fails loudly instead of quietly using local disk", async () => {
      setEnv({ STORAGE_DRIVER: "supabase", SUPABASE_URL: SB.SUPABASE_URL, SUPABASE_BUCKET: undefined, SUPABASE_SECRET_KEY: undefined });
      const { auth } = await makeUser();
      const errors = console.error;
      console.error = () => {};
      let res;
      try {
        res = await upload(auth, PNG, "logo.png", "image/png");
      } finally {
        console.error = errors;
      }
      assert.equal(res.status, 502);
      assert.deepEqual(stored(), [], "nothing fell back to local disk");
    });
  });
});
