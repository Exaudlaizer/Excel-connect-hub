require("dotenv").config();

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const jobRoutes = require("./routes/jobRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const adRoutes = require("./routes/adRoutes");
const courseRoutes = require("./routes/courseRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { assertEnv } = require("./config/env");
require("./models");

assertEnv();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 250,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "excel-connect-hub-api" });
});

// Credential endpoints get a much tighter budget than the global limiter:
// 250 attempts per window is a comfortable brute-force allowance.
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again later." }
  })
);
app.use(
  "/api/auth/register",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many accounts created from this address. Try again later." }
  })
);

// Reset requests trigger email and are a spam/enumeration vector, so they get
// their own tight budget on top of the global limiter.
app.use(
  "/api/auth/forgot-password",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many reset requests. Try again later." }
  })
);
app.use(
  "/api/auth/reset-password",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many reset attempts. Try again later." }
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
