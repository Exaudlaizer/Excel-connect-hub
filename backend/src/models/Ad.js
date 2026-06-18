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
    imageUrl: DataTypes.STRING,
    location: DataTypes.STRING,
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "expired"),
      defaultValue: "pending"
    }
  },
  { tableName: "ads" }
);

Ad.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = Ad;
