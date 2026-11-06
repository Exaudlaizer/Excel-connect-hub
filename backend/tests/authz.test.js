const { test, describe, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { hasDb, load, resetDb, makeUser, closeDb } = require("./helpers");

/**
 * Authorization matrix.
 *
 * This table is the specification of who may call what, written independently
 * of the route files. Every route the app registers must appear here, so adding
 * an endpoint without deciding its access rule fails the suite.
 *
 *   public    anyone, no token needed
 *   optional  anyone; a valid token only widens what they see
 *   auth      any signed-in, active account
 *   [roles]   only those roles
 *
 * For each route the matrix checks: anonymous and suspended callers get 401 on
 * protected routes, a role outside the list gets exactly 403, and every allowed
 * role gets past the gate (anything except 401/403: a 400 for an empty body or a
 * 404 for a made-up id both mean "you were allowed to try").
 */

const ALL = ["student", "company", "mentor", "admin"];

const SPEC = {
  // auth
  "POST /api/auth/register": "public",
  "POST /api/auth/login": "public",
  "POST /api/auth/forgot-password": "public",
  "POST /api/auth/reset-password": "public",
  "POST /api/auth/verification/request": "auth",
  "POST /api/auth/verification/confirm": "auth",
  "POST /api/auth/verification/request-public": "public",
  "POST /api/auth/verification/confirm-public": "public",
  "GET /api/auth/me": "auth",
  "POST /api/auth/logout-all": "auth",
  // users
  "GET /api/users": ["admin"],
  "PATCH /api/users/me": "auth",
  "PATCH /api/users/:id/status": ["admin"],
  "PATCH /api/users/:id/role": ["admin"],
  // jobs
  "GET /api/jobs": "optional",
  "GET /api/jobs/mine": ["company", "admin"],
  "POST /api/jobs": ["company", "admin"],
  "PATCH /api/jobs/:id": ["company", "admin"],
  "DELETE /api/jobs/:id": ["company", "admin"],
  "PATCH /api/jobs/:id/approval": ["admin"],
  // applications
  "POST /api/applications": ["student"],
  "GET /api/applications/mine": ["student"],
  "GET /api/applications/applicants": ["company", "admin"],
  "PATCH /api/applications/:id/status": ["company", "admin"],
  // ads
  "GET /api/ads": "optional",
  "GET /api/ads/mine": "auth",
  "POST /api/ads": ALL,
  "PATCH /api/ads/:id": "auth",
  "DELETE /api/ads/:id": "auth",
  "PATCH /api/ads/:id/approval": ["admin"],
  // courses
  "GET /api/courses": "optional",
  "POST /api/courses": ["mentor", "admin"],
  "POST /api/courses/:id/enroll": ["student"],
  "PATCH /api/courses/:id": ["mentor", "admin"],
  "DELETE /api/courses/:id": ["mentor", "admin"],
  "PATCH /api/courses/:id/approval": ["admin"],
  // community
  "GET /api/community": "optional",
  "GET /api/community/:id": "optional",
  "POST /api/community": "auth",
  "POST /api/community/:id/replies": "auth",
  "PATCH /api/community/:id/pin": ["admin"],
  "DELETE /api/community/:id": "auth",
  "DELETE /api/community/:id/replies/:replyId": "auth",
  // services
  "GET /api/services": "optional",
  "POST /api/services": ["admin"],
  "PATCH /api/services/:id": ["admin"],
  "DELETE /api/services/:id": ["admin"],
  // uploads
  "POST /api/uploads": ALL,
  "DELETE /api/uploads/:filename": ["admin"],
  // billing
  "GET /api/billing/plans": "auth",
  "GET /api/billing/subscription": "auth",
  "GET /api/billing/payments": "auth",
  "POST /api/billing/checkout": "auth",
  "POST /api/billing/confirm": "auth",
  "POST /api/billing/cancel": "auth",
  "POST /api/billing/webhook": "public",
  // admin
  "GET /api/admin/analytics": ["admin"],
  "GET /api/admin/audit": ["admin"]
};

// Reads the routes the Express app really has, so the spec can be checked for
// completeness in both directions.
function registeredRoutes(app) {
  const found = new Set();
  app._router.stack.forEach((layer) => {
    if (layer.name !== "router") return;
    const mount = layer.regexp.source
      .replace(/\\\/\?\(\?=\\\/\|\$\)/g, "")
      .replace(/^\^/, "")
      .replace(/\\\//g, "/");
    layer.handle.stack.forEach((entry) => {
      if (!entry.route) return;
      const method = Object.keys(entry.route.methods)[0].toUpperCase();
      const path = (mount + entry.route.path).replace(/\/+$/, "") || "/";
      found.add(`${method} ${path}`);
    });
  });
  return found;
}

describe("authorization matrix", { skip: !hasDb && "set TEST_DATABASE_URL to run integration tests" }, () => {
  let request, app;
  const actors = {};

  before(async () => {
    ({ request, app } = load());
    await resetDb();
    actors.student = await makeUser({ role: "student" });
    actors.company = await makeUser({ role: "company" });
    actors.mentor = await makeUser({ role: "mentor" });
    actors.admin = await makeUser({ role: "admin" });
    const suspended = await makeUser({ role: "admin" });
    await suspended.user.update({ status: "suspended" });
    actors.suspended = suspended;
  });
  after(closeDb);

  // Some routes change an account's session state (e.g. "sign out everywhere"
  // revokes the caller's tokens). Give every actor a fresh token before each test
  // so the order of routes in the matrix can never matter.
  beforeEach(async () => {
    const { signToken } = load();
    for (const actor of Object.values(actors)) {
      await actor.user.reload();
      actor.auth = { Authorization: `Bearer ${signToken(actor.user)}` };
    }
  });

  test("every registered route is in the spec, and every spec entry is a real route", () => {
    const registered = registeredRoutes(app);
    // The health check and static files live outside /api.
    const missingFromSpec = [...registered].filter((route) => !(route in SPEC)).sort();
    const notRegistered = Object.keys(SPEC).filter((route) => !registered.has(route)).sort();

    assert.deepEqual(missingFromSpec, [], "routes with no access rule in the spec");
    assert.deepEqual(notRegistered, [], "spec entries that match no route");
  });

  const fill = (path) => path.replace(/:[A-Za-z]+/g, "00000000-0000-4000-8000-000000000000");
  const call = (method, path, actor) => {
    const req = request(app)[method.toLowerCase()](fill(path));
    if (actor) req.set(actor.auth);
    return req.send({});
  };
  const passedGate = (res) => res.status !== 401 && res.status !== 403;

  for (const [route, access] of Object.entries(SPEC)) {
    const [method, path] = route.split(" ");

    test(route, async () => {
      if (access === "public" || access === "optional") {
        for (const [label, actor] of [["anonymous", null], ["student", actors.student], ["suspended", actors.suspended]]) {
          const res = await call(method, path, actor);
          assert.ok(passedGate(res), `${label} was blocked with ${res.status} on a ${access} route`);
        }
        return;
      }

      const anonymous = await call(method, path, null);
      assert.equal(anonymous.status, 401, "anonymous must be 401");

      const suspended = await call(method, path, actors.suspended);
      assert.equal(suspended.status, 401, "a suspended account's token must stop working (401)");

      const allowed = access === "auth" ? ALL : access;
      for (const role of ALL) {
        const res = await call(method, path, actors[role]);
        if (allowed.includes(role)) {
          assert.ok(passedGate(res), `${role} should be allowed but got ${res.status}`);
        } else {
          assert.equal(res.status, 403, `${role} should be refused with 403 but got ${res.status}`);
        }
      }
    });
  }
});
