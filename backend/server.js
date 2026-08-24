const { connectDB, sequelize } = require("./config/db");
const { closeRateLimitStore, initRateLimitStore } = require("./src/config/rateLimit");
const { verifyTransport } = require("./src/utils/mailer");

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

  const app = require("./app");

  server = app.listen(PORT, () => {
    console.log(`Excel Connect Hub API running on port ${PORT}`);
  });
}

// Without this catch a failed database connection is an unhandled rejection:
// the process stays alive, nothing is listening, and nothing is logged.
start().catch((error) => {
  console.error("Failed to start the API:", error.message);
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
