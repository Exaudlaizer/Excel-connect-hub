const User = require("../models/User");
const { signToken } = require("../utils/tokens");
const { issueVerification } = require("./emailVerificationController");

function publicUser(user) {
  return {
    id: user.id,
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
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
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ where: { email: email.toLowerCase() } });

    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const safeRole = SELF_SERVICE_ROLES.includes(role) ? role : "student";
    const user = await User.create({ name, email, password, role: safeRole });
    await issueVerification(user);
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
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

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

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

module.exports = { register, login, me, publicUser, SELF_SERVICE_ROLES };
