const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * An append-only ledger of payment attempts. Even a failed or abandoned attempt
 * leaves a row, because reconciliation against the gateway later needs to see
 * every txRef that was ever issued, not just the ones that succeeded.
 *
 * `txRef` is our own idempotency key: the webhook looks a payment up by it and
 * refuses to process the same reference twice.
 */
const Payment = sequelize.define(
  "Payment",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    planKey: DataTypes.STRING(60),
    provider: {
      type: DataTypes.ENUM("none", "manual", "flutterwave"),
      allowNull: false,
      defaultValue: "flutterwave"
    },
    txRef: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    providerId: DataTypes.STRING(120),
    amountMinor: { type: DataTypes.INTEGER, allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "TZS" },
    status: {
      type: DataTypes.ENUM("pending", "successful", "failed", "refunded"),
      allowNull: false,
      defaultValue: "pending"
    },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { tableName: "payments" }
);

module.exports = Payment;
