require("dotenv").config();

const { sequelize } = require("../config/db");
require("../models");

// Destroys ALL data and rebuilds the schema from the models.
//
//   npm run db:reset -- --yes
//
// Drops the whole `public` schema rather than just the tables: Postgres ENUM
// types survive a table drop, so a plain sync() leaves stale role enums behind
// and the new values never take effect.

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "This permanently deletes every row in the database.\n" +
        "Re-run with --yes to confirm:  npm run db:reset -- --yes"
    );
    process.exitCode = 1;
    return;
  }

  if (process.env.NODE_ENV === "production" && !process.argv.includes("--i-know-this-is-production")) {
    console.error("Refusing to wipe a production database. Pass --i-know-this-is-production to override.");
    process.exitCode = 1;
    return;
  }

  await sequelize.authenticate();

  console.log("Dropping schema...");
  await sequelize.query("DROP SCHEMA public CASCADE;");
  await sequelize.query("CREATE SCHEMA public;");

  console.log("Rebuilding tables from models...");
  await sequelize.sync();

  console.log("Database is empty and the schema is current.");
  console.log("Next: npm run seed:admin -- --email=you@example.com --password=your-password");

  await sequelize.close();
}

main().catch(async (error) => {
  console.error("Reset failed:", error.message);
  await sequelize.close().catch(() => {});
  process.exitCode = 1;
});
