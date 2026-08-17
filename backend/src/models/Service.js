const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * A university or student-support service, curated by administrators.
 *
 * This is a read-mostly directory: students read it, only admins write to it.
 * The directory is empty until an admin adds entries — the UI shows an honest
 * empty state rather than placeholder listings.
 */
const Service = sequelize.define(
  "Service",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(180),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM("academic", "career", "wellbeing", "financial", "housing", "technology", "library", "other"),
      allowNull: false,
      defaultValue: "other"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    provider: DataTypes.STRING(180),
    location: DataTypes.STRING(180),
    contactEmail: DataTypes.STRING(180),
    contactPhone: DataTypes.STRING(40),
    url: DataTypes.STRING(500),
    status: {
      type: DataTypes.ENUM("active", "archived"),
      allowNull: false,
      defaultValue: "active"
    },
    createdById: DataTypes.UUID
  },
  {
    tableName: "services",
    indexes: [
      { name: "services_status_category_idx", fields: ["status", "category"] },
      { name: "services_created_by_id_idx", fields: ["createdById"] }
    ]
  }
);

Service.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = Service;
