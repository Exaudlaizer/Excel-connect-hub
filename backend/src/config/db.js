const { Sequelize } = require("sequelize");

const databaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/excel_connect_hub";

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "production" ? false : console.log
});

async function connectDB() {
  await sequelize.authenticate();
  // Schema alteration is intentionally opt-in. Running `alter` on every dev
  // boot can take minutes against an existing database, leaving the API port
  // closed and making the frontend report a network/auth failure. Use
  // DB_SYNC_ALTER=true only when changing model schema locally.
  if (process.env.DB_SYNC_ALTER === "true") await sequelize.sync({ alter: true });
  console.log("PostgreSQL connected");
}

module.exports = { sequelize, connectDB };
