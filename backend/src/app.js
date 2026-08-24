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
app.use(makeLimiter({ name: "global", windowMs: 15 * 60 * 1000, limit: 250 }));

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

// Credential endpoints get a much tighter budget than the global limiter. The
// global allowance of 250 requests per window is far too generous for a login
// form — it is a comfortable brute-force budget.
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
app.use(
  "/api/auth/register",
  makeLimiter({
    name: "register",
    windowMs: 60 * 60 * 1000,
    limit: 20,
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
// Sending a code costs an email, so requests are budgeted tightly. Confirming
// one is cheap but is a guessing surface, so it gets a separate, looser budget
// on top of the five-attempt limit carried by the code itself.
app.use(
  ["/api/auth/verification/request", "/api/auth/verification/request-public"],
  makeLimiter({
    name: "otp-request",
    windowMs: 60 * 60 * 1000,
    limit: 8,
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
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
