const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * One subscription per account (the userId is unique). Every account has one,
 * defaulting to the Free plan, so "what can this account do" is always a single
 * lookup rather than a null check.
 */
const Subscription = sequelize.define(
  "Subscription",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    planKey: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "free" },
    status: {
      type: DataTypes.ENUM("active", "trialing", "past_due", "canceled"),
      allowNull: false,
      defaultValue: "active"
    },
    provider: {
      type: DataTypes.ENUM("none", "manual", "flutterwave"),
      allowNull: false,
      defaultValue: "none"
    },
    providerRef: DataTypes.STRING(190),
    currentPeriodStart: DataTypes.DATE,
    currentPeriodEnd: DataTypes.DATE,
    cancelAtPeriodEnd: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  { tableName: "subscriptions" }
);

module.exports = Subscription;
