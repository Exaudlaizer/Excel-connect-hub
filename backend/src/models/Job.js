const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Job = sequelize.define(
  "Job",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM("job", "internship"),
      allowNull: false
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false
    },
    workMode: {
      type: DataTypes.ENUM("onsite", "remote", "hybrid"),
      defaultValue: "onsite"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    requirements: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    salaryRange: DataTypes.STRING,
    deadline: DataTypes.DATE,
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "closed"),
      defaultValue: "pending"
    }
  },
  { tableName: "jobs" }
);

Job.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = Job;
