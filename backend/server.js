// Loaded first: config/db reads DATABASE_URL at module scope, and it is now
// required before ./app (which used to be what pulled dotenv in). Without this
// line the connection string falls back to its default and the API starts
// against the wrong database.
require("dotenv").config();

const monitoring = require("./src/utils/monitoring");

// Error reporting starts first so that a failure while booting is captured too.
// It does nothing unless SENTRY_DSN is set.
monitoring.init();

const { connectDB, sequelize } = require("./src/config/db");
const { closeRateLimitStore, initRateLimitStore } = require("./src/config/rateLimit");
const { verifyTransport } = require("./src/utils/mailer");
const { alertOperators, flushAlerts } = require("./src/utils/alerts");
const { installProcessHandlers } = require("./src/utils/processGuards");

// Anything nobody caught: log it, report it, tell the operators, then exit so
// the host restarts a clean process.
installProcessHandlers({
  alert: alertOperators,
  capture: monitoring.captureException,
  flush: async () => {
    await flushAlerts();
    await monitoring.flush();
  }
});

const PORT = process.env.PORT || 5000;

let server;

async function start() {
  await connectDB();

  // Both of these must settle before the app module is loaded: the limiters are
  // built at require time and need to know which store they are using, and a
  // bad SMTP password should be reported at boot rather than discovered by the
  // first user who tries to register.
  await initRateLimitStore();
  await verifyTransport();

  const app = require("./src/app");

  server = app.listen(PORT, () => {
    console.log(`Excel Connect Hub API running on port ${PORT}`);
  });
}

// Without this catch a failed database connection is an unhandled rejection:
// the process stays alive, nothing is listening, and nothing is logged.
start().catch(async (error) => {
  console.error(JSON.stringify({ level: "fatal", message: "Failed to start the API", error: error.message }));
  monitoring.captureException(error, { phase: "boot" });
  await monitoring.flush();
  process.exit(1);
});

// Close the HTTP server and the connection pools on shutdown so in-flight
// requests finish and neither Postgres nor Redis accumulates orphaned
// connections.
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);

  const done = () =>
    Promise.all([
      sequelize.close().catch(() => {}),
      closeRateLimitStore().catch(() => {}),
      flushAlerts().catch(() => {}),
      monitoring.flush()
    ]).then(() => process.exit(0));

  if (!server) return done();

  server.close(done);
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10000).unref();
}

["SIGINT", "SIGTERM"].forEach((signal) => process.on(signal, () => shutdown(signal)));
