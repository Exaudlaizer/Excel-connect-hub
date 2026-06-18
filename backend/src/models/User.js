const bcrypt = require("bcryptjs");
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM("student", "company", "admin"),
      defaultValue: "student"
    },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      defaultValue: "active"
    },
    studentProfile: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    companyProfile: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: "users",
    hooks: {
      beforeCreate: async (user) => {
        user.email = user.email.toLowerCase();
        user.password = await bcrypt.hash(user.password, 12);
      },
      beforeUpdate: async (user) => {
        if (user.changed("email")) user.email = user.email.toLowerCase();
        if (user.changed("password")) user.password = await bcrypt.hash(user.password, 12);
      }
    }
  }
);

User.prototype.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

User.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.password;
  return values;
};

module.exports = User;
