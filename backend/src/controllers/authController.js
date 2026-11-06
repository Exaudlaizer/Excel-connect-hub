const User = require("../models/User");
const Subscription = require("../models/Subscription");
const { sequelize } = require("../config/db");
const { revokeTokens, signToken } = require("../utils/tokens");
const { issueCode } = require("./otpController");

function publicUser(user) {
  return {
    id: user.id,
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    preferences: user.preferences || {},
    planKey: user.subscription?.planKey || "free",
    studentProfile: user.studentProfile,
    companyProfile: user.companyProfile,
    mentorProfile: user.mentorProfile
  };
}

// Roles a visitor may claim for themselves. "admin" is deliberately absent:
// self-service registration must never mint an administrator. Admins are
// created out of band with `npm run seed:admin`.
const SELF_SERVICE_ROLES = ["student", "company", "mentor"];

async function register(req, res, next) {
  try {
    const { name, email, password, phone, role } = req.body;
    const existing = await User.findOne({ where: { email: email.toLowerCase() } });

    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const safeRole = SELF_SERVICE_ROLES.includes(role) ? role : "student";
    // One transaction: if the Free subscription cannot be created (for example
    // the plans were never seeded) the user is rolled back too. Otherwise the
    // caller gets a 500 and every retry is told the email is already taken.
    const user = await sequelize.transaction(async (transaction) => {
      const created = await User.create(
        { name, email, password, role: safeRole, phone: phone ? String(phone).trim() : null },
        { transaction }
      );
      // Every account starts on the Free plan. Created here so the record exists
      // from the first request rather than being lazily backfilled later.
      await Subscription.create({ userId: created.id, planKey: "free", status: "active", provider: "none" }, { transaction });
      return created;
    });

    // Delivered by email; a failure here must not fail the registration, the
    // user can request another code from the verification screen.
    await issueCode(user, "email").catch((error) => console.error("Could not send verification code:", error.message));
    res.status(201).json({
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      where: { email: email.toLowerCase() },
      include: [{ model: Subscription, as: "subscription" }]
    });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is suspended" });
    }

    res.json({
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

// Cancels every login this account has, on every device, including this one.
async function logoutAll(req, res, next) {
  try {
    await revokeTokens(req.user);
    res.json({ message: "You have been signed out on every device." });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

module.exports = { register, login, logoutAll, me, publicUser, SELF_SERVICE_ROLES };
