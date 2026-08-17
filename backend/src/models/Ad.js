const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Ad = sequelize.define(
  "Ad",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Who is advertising. Without this the catalogue can only show the account
    // holder's personal name, which is not what a business listing should say.
    businessName: DataTypes.STRING,
    logoUrl: DataTypes.STRING(500),
    linkUrl: DataTypes.STRING(500),
    category: {
      type: DataTypes.ENUM("technology", "food", "fashion", "events", "services", "housing", "other"),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    price: DataTypes.DECIMAL(12, 2),
    contact: {
      type: DataTypes.STRING,
      allowNull: false
    },
    imageUrl: DataTypes.STRING(500),
    location: DataTypes.STRING,
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "expired"),
      defaultValue: "pending"
    }
  },
  {
    tableName: "ads",
    indexes: [
      { name: "ads_owner_id_idx", fields: ["ownerId"] },
      { name: "ads_status_created_at_idx", fields: ["status", "createdAt"] },
      { name: "ads_category_idx", fields: ["category"] }
    ]
  }
);

Ad.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = Ad;
