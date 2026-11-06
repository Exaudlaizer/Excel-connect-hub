const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, captureMail, extractCode, closeDb } = require("./helpers");

describe("email verification codes", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app, models;
  before(() => ({ request, app, models } = load()));
  beforeEach(resetDb);
  after(closeDb);

  const requestCode = (auth) => captureMail(() => request(app).post("/api/auth/verification/request").set(auth).send({}));
  const confirm = (auth, code) => request(app).post("/api/auth/verification/confirm").set(auth).send({ code });
  const age = (ms) => models.OtpCode.update({ createdAt: new Date(Date.now() - ms) }, { where: {}, silent: true });

  test("the code is emailed, stored only as a hash, and confirming it verifies the account", async () => {
    const { user, auth } = await makeUser({ emailVerified: false });
    const { result, mail } = await requestCode(auth);
    assert.equal(result.status, 200);

    const code = extractCode(mail);
    assert.match(code, /^\d{6}$/);
    assert.match(mail, new RegExp(user.email.replace(".", "\\.")));

    const row = await models.OtpCode.findOne({ where: { userId: user.id } });
    assert.notEqual(row.codeHash, code, "the code must not be stored in the clear");
    assert.equal(row.codeHash.length, 64);

    assert.equal((await confirm(auth, code)).status, 200);
    assert.equal((await user.reload()).emailVerified, true);
  });

  test("a second request inside 60 seconds is refused with a retry time", async () => {
    const { auth } = await makeUser({ emailVerified: false });
    assert.equal((await requestCode(auth)).result.status, 200);
    const again = await requestCode(auth);
    assert.equal(again.result.status, 429);
    assert.ok(again.result.body.retryAfter > 0 && again.result.body.retryAfter <= 60);
    assert.equal(await models.OtpCode.count(), 1, "no extra code may be created during the cooldown");
  });

  test("a new code retires the old one", async () => {
    const { auth } = await makeUser({ emailVerified: false });
    const first = extractCode((await requestCode(auth)).mail);
    await age(120000);
    const second = extractCode((await requestCode(auth)).mail);
    assert.notEqual(first, second);

    assert.equal(await models.OtpCode.count({ where: { consumedAt: null } }), 1, "exactly one live code per purpose");
    assert.equal((await confirm(auth, first)).status, 400, "the old code must no longer work");
    assert.equal((await confirm(auth, second)).status, 200);
  });

  test("a wrong code is refused and counts down the remaining attempts", async () => {
    const { auth } = await makeUser({ emailVerified: false });
    const code = extractCode((await requestCode(auth)).mail);
    const wrong = code === "000000" ? "111111" : "000000";
    const res = await confirm(auth, wrong);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /4 attempts left/);
  });

  test("five wrong guesses burn the code, even if the sixth guess is right", async () => {
    const { user, auth } = await makeUser({ emailVerified: false });
    const code = extractCode((await requestCode(auth)).mail);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i += 1) assert.equal((await confirm(auth, wrong)).status, 400);

    const sixth = await confirm(auth, code);
    assert.equal(sixth.status, 429);
    assert.equal((await user.reload()).emailVerified, false);
  });

  test("an expired code is refused", async () => {
    const { auth } = await makeUser({ emailVerified: false });
    const code = extractCode((await requestCode(auth)).mail);
    await models.OtpCode.update({ expiresAt: new Date(Date.now() - 1000) }, { where: {} });
    const res = await confirm(auth, code);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /expired/i);
  });

  test("a code must be exactly six digits", async () => {
    const { auth } = await makeUser({ emailVerified: false });
    for (const bad of ["12345", "1234567", "abcdef", "12 345"]) {
      assert.equal((await confirm(auth, bad)).status, 400, bad);
    }
  });

  test("a code only ever verifies the account it was issued to", async () => {
    const a = await makeUser({ emailVerified: false });
    const b = await makeUser({ emailVerified: false });
    const codeForA = extractCode((await requestCode(a.auth)).mail);
    await requestCode(b.auth);
    assert.equal((await confirm(b.auth, codeForA)).status, 400, "A's code must not verify B");
    assert.equal((await b.user.reload()).emailVerified, false);
  });

  test("an already-verified account is told so and no code is sent", async () => {
    const { auth } = await makeUser({ emailVerified: true });
    const { result } = await requestCode(auth);
    assert.equal(result.status, 200);
    assert.equal(result.body.alreadyVerified, true);
    assert.equal(await models.OtpCode.count(), 0);
  });

  test("the phone code needs a phone number first", async () => {
    const { auth } = await makeUser({ emailVerified: true });
    const res = await request(app).post("/api/auth/verification/request").set(auth).send({ purpose: "phone" });
    assert.equal(res.status, 400);
  });

  describe("public variants (no sign-in)", () => {
    const requestPublic = (email) => captureMail(() => request(app).post("/api/auth/verification/request-public").send({ email }));
    const confirmPublic = (email, code) => request(app).post("/api/auth/verification/confirm-public").send({ email, code });

    test("requesting gives the same answer whether or not the address has an account", async () => {
      const { user } = await makeUser({ emailVerified: false });
      const known = await requestPublic(user.email);
      const unknown = await requestPublic("nobody@example.com");
      assert.equal(known.result.status, unknown.result.status);
      assert.deepEqual(known.result.body, unknown.result.body);
      assert.ok(extractCode(known.mail), "a real account receives its code");
      assert.equal(extractCode(unknown.mail), undefined, "an unknown address receives nothing");
    });

    test("confirming works with the emailed code", async () => {
      const { user } = await makeUser({ emailVerified: false });
      const code = extractCode((await requestPublic(user.email)).mail);
      assert.equal((await confirmPublic(user.email, code)).status, 200);
      assert.equal((await user.reload()).emailVerified, true);
    });

    test("a wrong code is indistinguishable from an unknown address (no account enumeration)", async () => {
      const { user } = await makeUser({ emailVerified: false });
      await requestPublic(user.email);
      const knownWrong = await confirmPublic(user.email, "000000");
      const unknown = await confirmPublic("nobody@example.com", "000000");
      assert.equal(knownWrong.status, unknown.status);
      assert.equal(knownWrong.body.message, unknown.body.message);
    });

    test("an account that never asked for a code looks the same as an unknown address", async () => {
      const { user } = await makeUser({ emailVerified: false });
      const knownNoCode = await confirmPublic(user.email, "123456");
      const unknown = await confirmPublic("nobody@example.com", "123456");
      assert.equal(knownNoCode.status, unknown.status);
      assert.equal(knownNoCode.body.message, unknown.body.message);
    });
  });
});
