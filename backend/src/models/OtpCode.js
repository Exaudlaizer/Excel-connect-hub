const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * A single-use verification code.
 *
 * Only the SHA-256 hash of the code is stored. A dump of this table therefore
 * cannot be used to verify anybody's address — and nor can an administrator
 * reading the database read the code out and use it.
 *
 * `target` pins the code to the address or number it was sent to. If the user
 * edits their phone number after requesting a code, the stored target no longer
 * matches and the code is refused, so a code can never confirm a value it was
 * not delivered to.
 */
const OtpCode = sequelize.define(
  "OtpCode",
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
    purpose: {
      type: DataTypes.ENUM("email", "phone"),
      allowNull: false
    },
    codeHash: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    target: {
      type: DataTypes.STRING(190),
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    consumedAt: DataTypes.DATE,
    // Guessing budget. A six-digit code has a million possibilities, but an
    // unlimited attempt count would still fall to a script in minutes.
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    tableName: "otp_codes",
    indexes: [
      { name: "otp_codes_lookup_idx", fields: ["userId", "purpose", "consumedAt"] },
      { name: "otp_codes_expires_idx", fields: ["expiresAt"] }
    ]
  }
);

module.exports = OtpCode;
