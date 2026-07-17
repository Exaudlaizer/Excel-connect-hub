require("dotenv").config();

const { sequelize } = require("../config/db");
const User = require("../models/User");

// Administrators cannot be created through POST /api/auth/register, so this is
// the supported way to bootstrap the first admin (and to add more later).
//
//   npm run seed:admin -- --email=admin@example.com --password=secret123 --name="Site Admin"
//
// Values may also come from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
// Re-running with an existing email promotes that account to admin and resets
// its password, which doubles as an "I locked myself out" recovery path.

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) acc[match[1]] = match[2];
    return acc;
  }, {});
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = args.name || process.env.ADMIN_NAME || "Site Admin";
  const email = (args.email || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = args.password || process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    console.error(
      "Missing credentials.\n" +
        'Usage: npm run seed:admin -- --email=admin@example.com --password=secret123 [--name="Site Admin"]\n' +
        "Or set ADMIN_EMAIL and ADMIN_PASSWORD in the environment."
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters, to match the API's own rule.");
    process.exitCode = 1;
    return;
  }

  await sequelize.authenticate();
  await sequelize.sync();

  const existing = await User.findOne({ where: { email } });

  if (existing) {
    // The beforeUpdate hook re-hashes the password when it changes.
    await existing.update({ role: "admin", status: "active", password });
    console.log(`Promoted existing account to admin: ${email}`);
  } else {
    await User.create({ name, email, password, role: "admin" });
    console.log(`Created admin: ${email}`);
  }

  await sequelize.close();
}

main().catch(async (error) => {
  console.error("Failed to seed admin:", error.message);
  await sequelize.close().catch(() => {});
  process.exitCode = 1;
});
