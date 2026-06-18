const { Sequelize } = require("sequelize");

const databaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/excel_connect_hub";

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "production" ? false : console.log
});

async function connectDB() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: process.env.NODE_ENV !== "production" });
  console.log("PostgreSQL connected");
}

module.exports = { sequelize, connectDB };
