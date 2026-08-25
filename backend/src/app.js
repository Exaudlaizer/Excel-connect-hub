require("dotenv").config();

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const { makeLimiter } = require("./config/rateLimit");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const jobRoutes = require("./routes/jobRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const adRoutes = require("./routes/adRoutes");
const courseRoutes = require("./routes/courseRoutes");
const communityRoutes = require("./routes/communityRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const billingRoutes = require("./routes/billingRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { assertEnv } = require("./config/env");
const { UPLOAD_DIR } = require("./controllers/uploadController");
require("./models");

assertEnv();

const app = express();

// Behind a reverse proxy (Render, Fly, nginx, …) every request arrives from the
// proxy's IP. Without this the rate limiters bucket the whole internet together
// and a single noisy client locks everyone out.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use(
  helmet({
    // Uploaded images are served from this origin and rendered by the Next.js
    // app on another one. The default same-origin policy would block them.
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// Multiple origins may be listed comma-separated, e.g. a preview deploy plus
// production. Requests without an Origin header (curl, server-to-server) pass.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
// Backstop against a runaway client, not the real protection — the credential,
// verification and upload endpoints below carry their own tight budgets.
// 250 per 15 minutes worked out at ~17 requests a minute, and a single
// dashboard load makes five, so ordinary browsing was hitting it.
app.use(makeLimiter({ name: "global", windowMs: 15 * 60 * 1000, limit: 600 }));

// Uploaded images. Served read-only, with a long cache and no directory
// listing. `express.static` will not execute anything it serves.
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    index: false,
    maxAge: "7d",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff")
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "excel-connect-hub-api" });
});

// Credential endpoints get a much tighter budget than the global limiter,
// which is sized for ordinary browsing and would be a comfortable
// brute-force budget for a login form.
app.use(
  "/api/auth/login",
  makeLimiter({
    name: "login",
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    message: "Too many login attempts. Try again later."
  })
);
// Also per-IP, and the audience is students on shared campus wifi — twenty an
// hour would have meant twenty signups per hour for a whole university. What
// actually keeps junk accounts out is the unique-email constraint and the fact
// that an unverified account cannot do anything until a code sent to a real
// inbox is entered.
app.use(
  "/api/auth/register",
  makeLimiter({
    name: "register",
    windowMs: 60 * 60 * 1000,
    limit: 100,
    message: "Too many accounts created from this address. Try again later."
  })
);

// Reset requests trigger email and are a spam/enumeration vector, so they get
// their own tight budget on top of the global limiter.
app.use(
  "/api/auth/forgot-password",
  makeLimiter({
    name: "forgot",
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: "Too many reset requests. Try again later."
  })
);
app.use(
  "/api/auth/reset-password",
  makeLimiter({
    name: "reset",
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: "Too many reset attempts. Try again later."
  })
);
// These limiters key on IP, and a university campus puts hundreds of students
// behind one address — so a tight per-IP cap here would have them locking each
// other out of their own signups. The real controls are per-account and live in
// otpController: a 60-second cooldown between codes, one live code per purpose,
// and five guesses before a code is burned. This is only a backstop against a
// script hammering the endpoint.
app.use(
  ["/api/auth/verification/request", "/api/auth/verification/request-public"],
  makeLimiter({
    name: "otp-request",
    windowMs: 60 * 60 * 1000,
    limit: 60,
    message: "Too many verification codes requested. Try again later."
  })
);
app.use(
  ["/api/auth/verification/confirm", "/api/auth/verification/confirm-public"],
  makeLimiter({
    name: "otp-confirm",
    windowMs: 15 * 60 * 1000,
    limit: 30,
    message: "Too many verification attempts. Try again later."
  })
);

// Checkout starts an external payment session; keep it modest per IP.
app.use(
  "/api/billing/checkout",
  makeLimiter({
    name: "checkout",
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: "Too many checkout attempts. Please wait a moment and try again."
  })
);

// Uploads are the most expensive thing an authenticated user can do.
app.use(
  "/api/uploads",
  makeLimiter({
    name: "uploads",
    windowMs: 15 * 60 * 1000,
    limit: 40,
    message: "Too many uploads. Please wait a moment and try again."
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
