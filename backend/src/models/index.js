const Ad = require("./Ad");
const Application = require("./Application");
const Course = require("./Course");
const Job = require("./Job");
const PasswordResetToken = require("./PasswordResetToken");
const User = require("./User");

User.hasMany(Job, { foreignKey: "companyId", as: "jobs" });
Job.belongsTo(User, { foreignKey: "companyId", as: "company" });

User.hasMany(Application, { foreignKey: "studentId", as: "applications" });
Application.belongsTo(User, { foreignKey: "studentId", as: "student" });
Job.hasMany(Application, { foreignKey: "jobId", as: "applications" });
Application.belongsTo(Job, { foreignKey: "jobId", as: "job" });

User.hasMany(Ad, { foreignKey: "ownerId", as: "ads" });
Ad.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

User.hasMany(Course, { foreignKey: "providerId", as: "courses" });
Course.belongsTo(User, { foreignKey: "providerId", as: "provider" });

// Deleting a user must not strand reset tokens that could still be redeemed.
User.hasMany(PasswordResetToken, { foreignKey: "userId", as: "resetTokens", onDelete: "CASCADE" });
PasswordResetToken.belongsTo(User, { foreignKey: "userId", as: "user" });

module.exports = { Ad, Application, Course, Job, PasswordResetToken, User };
