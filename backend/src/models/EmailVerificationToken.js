const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

// Like password-reset tokens, verification tokens are stored only as hashes.
// The raw value is delivered in the email link and is never persisted.
const EmailVerificationToken = sequelize.define(
  "EmailVerificationToken",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    tokenHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    usedAt: DataTypes.DATE
  },
  {
    tableName: "email_verification_tokens",
    indexes: [{ fields: ["tokenHash"] }, { fields: ["userId"] }]
  }
);

module.exports = EmailVerificationToken;
