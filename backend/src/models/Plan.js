const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * A subscription plan. Seeded by `npm run seed:plans` and edited only by an
 * administrator; ordinary users read plans, they do not create them.
 *
 * `priceMinor` is an integer in the currency's minor unit, so money is never a
 * float. A free plan is simply price 0 — the Free plan every account starts on
 * is a real row, not a special case in code.
 */
const Plan = sequelize.define(
  "Plan",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    key: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: DataTypes.TEXT,
    audience: {
      type: DataTypes.ENUM("all", "company", "mentor", "business"),
      allowNull: false,
      defaultValue: "all"
    },
    priceMinor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "TZS" },
    interval: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "month" },
    features: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  },
  { tableName: "plans" }
);

Plan.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  // A convenience for the client so it does not re-implement minor-unit maths.
  values.price = values.priceMinor / 100;
  values.isFree = values.priceMinor === 0;
  return values;
};

module.exports = Plan;
