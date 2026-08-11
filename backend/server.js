const app = require("./app");
const { connectDB, sequelize } = require("./config/db");

const PORT = process.env.PORT || 5000;

let server;

async function start() {
  await connectDB();
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

// Close the HTTP server and the connection pool on shutdown so in-flight
// requests finish and Postgres does not accumulate orphaned connections.
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);

  const done = () =>
    sequelize
      .close()
      .catch(() => {})
      .then(() => process.exit(0));

  if (!server) return done();

  server.close(done);
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10000).unref();
}

["SIGINT", "SIGTERM"].forEach((signal) => process.on(signal, () => shutdown(signal)));
