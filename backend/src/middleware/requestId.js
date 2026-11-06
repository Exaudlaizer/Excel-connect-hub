const crypto = require("crypto");

// Accepts a caller-supplied id only if it is short and plain, so it is safe to
// put in logs and headers; otherwise a fresh one is generated.
const SAFE = /^[A-Za-z0-9._-]{8,64}$/;

function requestId(req, res, next) {
  const incoming = req.headers["x-request-id"];
  req.id = typeof incoming === "string" && SAFE.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

module.exports = requestId;
