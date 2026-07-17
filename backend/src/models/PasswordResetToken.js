const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

// Only the SHA-256 hash of a reset token is stored. The raw token exists solely
// in the email/console link, so a leaked database dump cannot be used to seize
// accounts — the same reasoning as hashing passwords.
const PasswordResetToken = sequelize.define(
  "PasswordResetToken",
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
    tableName: "password_reset_tokens",
    indexes: [{ fields: ["tokenHash"] }, { fields: ["userId"] }]
  }
);

module.exports = PasswordResetToken;
