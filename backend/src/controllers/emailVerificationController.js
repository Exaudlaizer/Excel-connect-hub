const crypto = require("crypto");
const { Op } = require("sequelize");
const EmailVerificationToken = require("../models/EmailVerificationToken");
const User = require("../models/User");
const { sendMail } = require("../utils/mailer");

const TOKEN_TTL_HOURS = 24;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function verificationLink(rawToken) {
  const base = process.env.CLIENT_ORIGIN || "http://localhost:3000";
  return `${base}/verify-email?token=${rawToken}`;
}

async function issueVerification(user) {
  if (user.emailVerified) return;

  await EmailVerificationToken.update({ usedAt: new Date() }, { where: { userId: user.id, usedAt: null } });
  const rawToken = crypto.randomBytes(32).toString("hex");
  await EmailVerificationToken.create({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000)
  });

  await sendMail({
    to: user.email,
    subject: "Verify your Excel Connect Hub email",
    text: [
      `Hello ${user.name},`,
      "",
      "Confirm your email to help us keep the Excel Connect Hub community secure:",
      "",
      verificationLink(rawToken),
      "",
      `This link expires in ${TOKEN_TTL_HOURS} hours. If you did not create this account, you can ignore this email.`
    ].join("\n")
  });
}

async function verifyEmail(req, res, next) {
  try {
    const record = await EmailVerificationToken.findOne({
      where: { tokenHash: hashToken(String(req.body.token)), usedAt: null, expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: User, as: "user" }]
    });

    if (!record || !record.user) {
      return res.status(400).json({ message: "This verification link is invalid or has expired. Request a new one." });
    }

    await record.user.update({ emailVerified: true });
    await EmailVerificationToken.update({ usedAt: new Date() }, { where: { userId: record.userId, usedAt: null } });
    res.json({ message: "Email verified. Your account is ready.", emailVerified: true });
  } catch (error) {
    next(error);
  }
}

async function resendVerification(req, res, next) {
  try {
    const user = await User.findOne({ where: { email: String(req.body.email || "").trim().toLowerCase() } });
    // Keep this endpoint non-enumerable, just like the password-reset endpoint.
    if (user && user.status === "active" && !user.emailVerified) await issueVerification(user);
    res.json({ message: "If that address needs verification, a confirmation link has been sent." });
  } catch (error) {
    next(error);
  }
}

module.exports = { issueVerification, resendVerification, verifyEmail };
