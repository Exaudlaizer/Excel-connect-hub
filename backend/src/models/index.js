const Ad = require("./Ad");
const Application = require("./Application");
const Course = require("./Course");
const Job = require("./Job");
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

module.exports = { Ad, Application, Course, Job, User };
