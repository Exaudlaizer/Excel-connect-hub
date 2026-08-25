// Loaded first: config/db reads DATABASE_URL at module scope, and it is now
// required before ./app (which used to be what pulled dotenv in). Without this
// line the connection string falls back to its default and the API starts
// against the wrong database.
require("dotenv").config();

const { assertEnv } = require("./src/config/env");
const { connectDB, sequelize } = require("./config/db");
const { closeRateLimitStore, initRateLimitStore } = require("./src/config/rateLimit");
const { verifyTransport } = require("./src/utils/mailer");

const PORT = process.env.PORT || 5000;

let server;

async function start() {
  assertEnv();
  await connectDB();

  // Both of these must settle before the app module is loaded: the limiters are
  // built at require time and need to know which store they are using, and a
  // bad SMTP password should be reported at boot rather than discovered by the
  // first user who tries to register.
  await initRateLimitStore();
  await verifyTransport();

  const app = require("./app");

  server = app.listen(PORT, () => {
    console.log(`Excel Connect Hub API running on port ${PORT}`);
  });
}

// Node throws an AggregateError when a hostname resolves to several addresses
// and every one of them fails. Its .message is an empty string and the real
// reasons live in .errors, so printing .message alone reported a failed boot
// as a blank line — which is exactly how a missing DATABASE_URL presented.
function describe(error) {
  if (!error) return "unknown error";
  const causes = error.errors || (error.parent && error.parent.errors);
  if (Array.isArray(causes) && causes.length) {
    const reasons = causes.map((cause) => cause.message || `${cause.code} ${cause.address}:${cause.port}`);
    return `${error.name}: ${reasons.join("; ")}`;
  }
  return error.message || (error.parent && error.parent.message) || `${error.name} (no message)`;
}

// Without this catch a failed database connection is an unhandled rejection:
// the process stays alive, nothing is listening, and nothing is logged.
start().catch((error) => {
  console.error("Failed to start the API:", describe(error));

  const refused = error.name === "SequelizeConnectionRefusedError" || (error.parent && error.parent.code === "ECONNREFUSED");
  if (refused) {
    console.error(
      "Nothing is listening at the address in DATABASE_URL. If that address is localhost,",
      "DATABASE_URL is unset and the built-in development default was used."
    );
  }

  process.exit(1);
});

// Close the HTTP server and the connection pools on shutdown so in-flight
// requests finish and neither Postgres nor Redis accumulates orphaned
// connections.
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);

  const done = () =>
    Promise.all([sequelize.close().catch(() => {}), closeRateLimitStore().catch(() => {})]).then(() =>
      process.exit(0)
    );

  if (!server) return done();

  server.close(done);
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10000).unref();
}

["SIGINT", "SIGTERM"].forEach((signal) => process.on(signal, () => shutdown(signal)));
