const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * A single admin-editable setting, keyed by a stable string.
 *
 * The value is JSONB so a setting can be a URL, a colour, a flag, or a small
 * object without a schema change. `isPublic` gates whether an anonymous visitor
 * may read it: background images are public because the login page needs them
 * before anyone signs in; anything operational would not be.
 */
const SiteSetting = sequelize.define(
  "SiteSetting",
  {
    key: { type: DataTypes.STRING(80), primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    isPublic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedById: DataTypes.UUID
  },
  { tableName: "site_settings" }
);

module.exports = SiteSetting;
