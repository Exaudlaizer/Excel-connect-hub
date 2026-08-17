const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Application = sequelize.define(
  "Application",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    coverLetter: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    cvUrl: DataTypes.STRING,
    status: {
      type: DataTypes.ENUM("submitted", "reviewing", "shortlisted", "rejected", "hired"),
      defaultValue: "submitted"
    }
  },
  {
    tableName: "applications",
    indexes: [
      { unique: true, fields: ["jobId", "studentId"] },
      { name: "applications_student_id_idx", fields: ["studentId"] }
    ]
  }
);

Application.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = Application;
