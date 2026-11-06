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
      type: DataTypes.ENUM("student", "company", "mentor", "admin"),
      defaultValue: "student"
    },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      defaultValue: "active"
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    // Bumped to cancel every login issued before now (password reset, suspension,
    // role change, "sign out everywhere"). Each token carries the value it was
    // issued under and is refused once it no longer matches.
    tokenVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    // UI preferences that should follow the account across devices — currently
    // the chosen theme. Kept as JSONB so adding another preference later is not
    // another migration.
    preferences: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    studentProfile: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    companyProfile: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    mentorProfile: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: "users",
    indexes: [{ name: "users_role_idx", fields: ["role"] }, { name: "users_status_idx", fields: ["status"] }],
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
