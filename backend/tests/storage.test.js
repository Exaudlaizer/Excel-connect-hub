const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
require("./helpers");
const { createSupabaseStorage } = require("../src/storage/supabase");
const { local, UPLOAD_DIR } = require("../src/storage/local");
const { getStorage, allStorages, ownerOf, driverName, missingSupabaseEnv } = require("../src/storage");
const { assertEnv } = require("../src/config/env");

const KEY = "1793879819388-50cdc283e8d38a30.png";
const SECRET = "sb_secret_TOPSECRETVALUE123456789";
const LEGACY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl";
const baseEnv = { SUPABASE_URL: "https://abcdefgh.supabase.co", SUPABASE_BUCKET: "media", SUPABASE_SECRET_KEY: SECRET };

// A stand-in for fetch that records what it was asked and answers as scripted.
function fakeFetch(...replies) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const next = replies.length > 1 ? replies.shift() : replies[0];
    if (next instanceof Error) throw next;
    return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body ?? {} };
  };
  return { impl, calls };
}
const ok = { status: 200, body: { Id: "x", Key: `media/${KEY}` } };

describe("Supabase driver: requests match Supabase's documentation", () => {
  test("upload: POST raw bytes to /storage/v1/object/{bucket}/{key} and return the public URL", async () => {
    const { impl, calls } = fakeFetch(ok);
    const storage = createSupabaseStorage({ env: baseEnv, fetchImpl: impl });
    const bytes = Buffer.from("image bytes");
    const saved = await storage.save({ key: KEY, buffer: bytes, mimetype: "image/png" });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `https://abcdefgh.supabase.co/storage/v1/object/media/${KEY}`);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.body, bytes, "the raw bytes, not multipart");
    assert.equal(calls[0].init.headers["Content-Type"], "image/png");
    assert.equal(calls[0].init.headers["x-upsert"], undefined, "never overwrite");
    assert.equal(saved.url, `https://abcdefgh.supabase.co/storage/v1/object/public/media/${KEY}`);
    assert.equal(saved.key, KEY);
  });

  test("a new-style secret key goes in the apikey header only, never as a bearer token", async () => {
    const { impl, calls } = fakeFetch(ok);
    await createSupabaseStorage({ env: baseEnv, fetchImpl: impl }).save({ key: KEY, buffer: Buffer.alloc(1), mimetype: "image/png" });
    assert.equal(calls[0].init.headers.apikey, SECRET);
    assert.equal(calls[0].init.headers.Authorization, undefined);
    assert.equal(calls[0].init.headers["User-Agent"], "excel-connect-hub-api", "a server, not a browser");
  });

  test("a legacy service_role JWT is sent on both headers", async () => {
    const { impl, calls } = fakeFetch(ok);
    const env = { ...baseEnv, SUPABASE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: LEGACY };
    await createSupabaseStorage({ env, fetchImpl: impl }).save({ key: KEY, buffer: Buffer.alloc(1), mimetype: "image/png" });
    assert.equal(calls[0].init.headers.apikey, LEGACY);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${LEGACY}`);
  });

  test("a trailing slash on SUPABASE_URL does not break the URLs", async () => {
    const { impl, calls } = fakeFetch(ok);
    const storage = createSupabaseStorage({ env: { ...baseEnv, SUPABASE_URL: "https://abcdefgh.supabase.co///" }, fetchImpl: impl });
    const saved = await storage.save({ key: KEY, buffer: Buffer.alloc(1), mimetype: "image/png" });
    assert.equal(calls[0].url, `https://abcdefgh.supabase.co/storage/v1/object/media/${KEY}`);
    assert.ok(saved.url.startsWith("https://abcdefgh.supabase.co/storage/v1/object/public/media/"));
  });

  test("a failed upload throws with the status and Supabase's message, and never leaks the key", async () => {
    const body = { statusCode: "409", error: "Duplicate", message: "The resource already exists", code: "Duplicate" };
    const { impl } = fakeFetch({ status: 400, body });
    await assert.rejects(
      createSupabaseStorage({ env: baseEnv, fetchImpl: impl }).save({ key: KEY, buffer: Buffer.alloc(1), mimetype: "image/png" }),
      (error) => {
        assert.equal(error.status, 400);
        assert.match(error.message, /upload failed \(400\).*already exists/);
        assert.ok(!error.message.includes(SECRET));
        return true;
      }
    );
  });

  test("a network failure propagates so the API can answer 502", async () => {
    const { impl } = fakeFetch(new Error("getaddrinfo ENOTFOUND"));
    await assert.rejects(createSupabaseStorage({ env: baseEnv, fetchImpl: impl }).save({ key: KEY, buffer: Buffer.alloc(1), mimetype: "image/png" }), /ENOTFOUND/);
  });

  test("it refuses to store under a name the server did not generate", async () => {
    const { impl, calls } = fakeFetch(ok);
    const storage = createSupabaseStorage({ env: baseEnv, fetchImpl: impl });
    for (const bad of ["../x.png", "evil.html", "a/b.png", "1-short.png", ""]) {
      await assert.rejects(storage.save({ key: bad, buffer: Buffer.alloc(1), mimetype: "image/png" }), /unexpected name/);
    }
    assert.equal(calls.length, 0);
  });

  test("delete: DELETE the object; 200 is removed, 404 is 'was not there', other errors throw", async () => {
    const storage = (reply) => {
      const f = fakeFetch(reply);
      return { s: createSupabaseStorage({ env: baseEnv, fetchImpl: f.impl }), calls: f.calls };
    };
    const a = storage({ status: 200, body: { message: "Successfully deleted" } });
    assert.equal(await a.s.remove(KEY), true);
    assert.equal(a.calls[0].init.method, "DELETE");
    assert.equal(a.calls[0].url, `https://abcdefgh.supabase.co/storage/v1/object/media/${KEY}`);

    assert.equal(await storage({ status: 404, body: {} }).s.remove(KEY), false);
    await assert.rejects(storage({ status: 500, body: { message: "boom" } }).s.remove(KEY), /delete failed \(500\)/);
  });

  test("delete refuses names the server did not generate and makes no request", async () => {
    const { impl, calls } = fakeFetch({ status: 200 });
    const s = createSupabaseStorage({ env: baseEnv, fetchImpl: impl });
    assert.equal(await s.remove("../../etc/passwd"), false);
    assert.equal(calls.length, 0);
  });

  test("keyFromUrl recognises only this project's public bucket URLs", () => {
    const s = createSupabaseStorage({ env: baseEnv, fetchImpl: fakeFetch(ok).impl });
    const own = `https://abcdefgh.supabase.co/storage/v1/object/public/media/${KEY}`;
    assert.equal(s.keyFromUrl(own), KEY);
    assert.equal(s.keyFromUrl(`${own}?t=1`), KEY, "query strings are ignored");
    assert.equal(s.keyFromUrl(`https://other.supabase.co/storage/v1/object/public/media/${KEY}`), null, "another project");
    assert.equal(s.keyFromUrl(`https://abcdefgh.supabase.co/storage/v1/object/public/other/${KEY}`), null, "another bucket");
    assert.equal(s.keyFromUrl("https://abcdefgh.supabase.co/storage/v1/object/public/media/../../x.png"), null);
    assert.equal(s.keyFromUrl("https://abcdefgh.supabase.co/storage/v1/object/public/media/notgenerated.png"), null);
    assert.equal(s.keyFromUrl(null), null);
  });
});

describe("local driver", () => {
  const key = () => `${Date.now()}-${require("crypto").randomBytes(8).toString("hex")}.png`;
  afterEach(() => fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }));
  beforeEach(() => fs.mkdirSync(UPLOAD_DIR, { recursive: true }));

  test("writes to the upload directory and returns an /uploads URL", async () => {
    const k = key();
    const saved = await local.save({ key: k, buffer: Buffer.from("x"), baseUrl: "https://api.example.com" });
    assert.equal(saved.url, `https://api.example.com/uploads/${k}`);
    assert.equal(fs.readFileSync(path.join(UPLOAD_DIR, k), "utf8"), "x");
  });

  test("never overwrites an existing file", async () => {
    const k = key();
    await local.save({ key: k, buffer: Buffer.from("first"), baseUrl: "http://x" });
    await assert.rejects(local.save({ key: k, buffer: Buffer.from("second"), baseUrl: "http://x" }), /EEXIST/);
    assert.equal(fs.readFileSync(path.join(UPLOAD_DIR, k), "utf8"), "first");
  });

  test("remove reports true once, then false", async () => {
    const k = key();
    await local.save({ key: k, buffer: Buffer.from("x"), baseUrl: "http://x" });
    assert.equal(await local.remove(k), true);
    assert.equal(await local.remove(k), false);
  });

  test("only generated names are ever written or deleted", async () => {
    for (const bad of ["../x.png", "evil.html", "a/b.png", ".htaccess"]) {
      await assert.rejects(local.save({ key: bad, buffer: Buffer.alloc(1), baseUrl: "http://x" }), /unexpected name/);
      assert.equal(await local.remove(bad), false);
    }
  });
});

describe("storage registry", () => {
  const saved = {};
  const setEnv = (vars) => {
    for (const [k, v] of Object.entries(vars)) {
      if (!(k in saved)) saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
      delete saved[k];
    }
  });
  const clean = { STORAGE_DRIVER: undefined, SUPABASE_URL: undefined, SUPABASE_BUCKET: undefined, SUPABASE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined };

  test("local is the default", () => {
    setEnv(clean);
    assert.equal(driverName(), "local");
    assert.equal(getStorage().name, "local");
    assert.deepEqual(allStorages().map((s) => s.name), ["local"]);
  });

  test("supabase is used when selected and complete; others are errors", () => {
    setEnv({ ...clean, STORAGE_DRIVER: "supabase", ...baseEnv });
    assert.equal(getStorage().name, "supabase");
    assert.deepEqual(allStorages().map((s) => s.name), ["local", "supabase"]);

    setEnv({ ...clean, STORAGE_DRIVER: "supabase", SUPABASE_URL: baseEnv.SUPABASE_URL });
    assert.throws(getStorage, /SUPABASE_BUCKET, SUPABASE_SECRET_KEY/);
    setEnv({ ...clean, STORAGE_DRIVER: "s3" });
    assert.throws(getStorage, /Unknown STORAGE_DRIVER/);
  });

  test("ownerOf finds the store that holds a URL, whichever driver is active", () => {
    setEnv({ ...clean, STORAGE_DRIVER: "supabase", ...baseEnv });
    const local1 = ownerOf(`https://api.example.com/uploads/${KEY}`);
    const remote = ownerOf(`https://abcdefgh.supabase.co/storage/v1/object/public/media/${KEY}`);
    assert.equal(local1.storage.name, "local");
    assert.equal(remote.storage.name, "supabase");
    assert.equal(ownerOf("https://cdn.example.com/photo.png"), null, "someone else's image is left alone");
  });

  test("missingSupabaseEnv names exactly what is absent; the legacy key name is accepted", () => {
    assert.deepEqual(missingSupabaseEnv({}), ["SUPABASE_URL", "SUPABASE_BUCKET", "SUPABASE_SECRET_KEY"]);
    assert.deepEqual(missingSupabaseEnv({ SUPABASE_URL: "u", SUPABASE_BUCKET: "b", SUPABASE_SERVICE_ROLE_KEY: LEGACY }), []);
  });

  describe("boot checks", () => {
    const good = { JWT_SECRET: "x".repeat(40), PAYMENTS_ENABLED: undefined, PAYMENT_PROVIDER: undefined };
    test("local needs nothing", () => {
      setEnv({ ...good, ...clean });
      assert.doesNotThrow(assertEnv);
    });
    test("a typo in STORAGE_DRIVER is rejected", () => {
      setEnv({ ...good, ...clean, STORAGE_DRIVER: "supabse" });
      assert.throws(assertEnv, /STORAGE_DRIVER "supabse" is not recognised/);
    });
    test("supabase must be fully configured", () => {
      setEnv({ ...good, ...clean, STORAGE_DRIVER: "supabase" });
      assert.throws(assertEnv, /requires: SUPABASE_URL, SUPABASE_BUCKET, SUPABASE_SECRET_KEY/);
      setEnv({ ...good, ...clean, STORAGE_DRIVER: "supabase", ...baseEnv });
      assert.doesNotThrow(assertEnv);
    });
    test("a publishable key is caught at boot", () => {
      setEnv({ ...good, ...clean, STORAGE_DRIVER: "supabase", ...baseEnv, SUPABASE_SECRET_KEY: "sb_publishable_abc123" });
      assert.throws(assertEnv, /publishable key/);
    });
    test("production requires https", () => {
      setEnv({ ...good, ...clean, STORAGE_DRIVER: "supabase", ...baseEnv, SUPABASE_URL: "http://abcdefgh.supabase.co", NODE_ENV: "production", DATABASE_URL: "postgres://x" });
      assert.throws(assertEnv, /https:\/\//);
    });
  });
});
