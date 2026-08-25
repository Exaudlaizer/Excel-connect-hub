const Ad = require("./Ad");
const Application = require("./Application");
const CommunityPost = require("./CommunityPost");
const CommunityReply = require("./CommunityReply");
const Course = require("./Course");
const Job = require("./Job");
const OtpCode = require("./OtpCode");
const Payment = require("./Payment");
const Plan = require("./Plan");
const PasswordResetToken = require("./PasswordResetToken");
const Service = require("./Service");
const SiteSetting = require("./SiteSetting");
const Subscription = require("./Subscription");
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

// Removing a member takes their posts and replies with them. Orphaned rows would
// render as "Unknown member" threads nobody can moderate.
User.hasMany(CommunityPost, { foreignKey: "authorId", as: "posts", onDelete: "CASCADE" });
CommunityPost.belongsTo(User, { foreignKey: "authorId", as: "author" });
CommunityPost.hasMany(CommunityReply, { foreignKey: "postId", as: "replies", onDelete: "CASCADE" });
CommunityReply.belongsTo(CommunityPost, { foreignKey: "postId", as: "post" });
User.hasMany(CommunityReply, { foreignKey: "authorId", as: "replies", onDelete: "CASCADE" });
CommunityReply.belongsTo(User, { foreignKey: "authorId", as: "author" });

// A directory entry outlives the admin who added it, so the author link is
// nulled rather than cascading the service away with the account.
User.hasMany(Service, { foreignKey: "createdById", as: "services", onDelete: "SET NULL" });
Service.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

// Deleting a user must not strand reset tokens that could still be redeemed.
User.hasMany(PasswordResetToken, { foreignKey: "userId", as: "resetTokens", onDelete: "CASCADE" });
PasswordResetToken.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(OtpCode, { foreignKey: "userId", as: "otpCodes", onDelete: "CASCADE" });
OtpCode.belongsTo(User, { foreignKey: "userId", as: "user" });

// Billing. One subscription per account; the plan is referenced by its stable
// key rather than its id so a plan can be re-seeded without breaking links.
User.hasOne(Subscription, { foreignKey: "userId", as: "subscription", onDelete: "CASCADE" });
Subscription.belongsTo(User, { foreignKey: "userId", as: "user" });
Subscription.belongsTo(Plan, { foreignKey: "planKey", targetKey: "key", as: "plan" });

User.hasMany(Payment, { foreignKey: "userId", as: "payments", onDelete: "CASCADE" });
Payment.belongsTo(User, { foreignKey: "userId", as: "user" });
Payment.belongsTo(Plan, { foreignKey: "planKey", targetKey: "key", as: "plan" });

module.exports = {
  Ad,
  Application,
  CommunityPost,
  CommunityReply,
  Course,
  Job,
  OtpCode,
  Payment,
  Plan,
  PasswordResetToken,
  Service,
  SiteSetting,
  Subscription,
  User
};
