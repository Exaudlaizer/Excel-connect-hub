const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Course = sequelize.define(
  "Course",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    duration: DataTypes.STRING,
    price: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    deliveryMode: {
      type: DataTypes.ENUM("online", "in-person", "hybrid"),
      defaultValue: "online"
    },
    startDate: DataTypes.DATE,
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "archived"),
      defaultValue: "pending"
    },
    enrolledStudents: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: []
    }
  },
  {
    tableName: "courses",
    indexes: [
      { name: "courses_provider_id_idx", fields: ["providerId"] },
      { name: "courses_status_created_at_idx", fields: ["status", "createdAt"] }
    ]
  }
);

Course.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = Course;
