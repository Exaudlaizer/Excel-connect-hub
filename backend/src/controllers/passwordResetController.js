const crypto = require("crypto");
const { Op } = require("sequelize");
const PasswordResetToken = require("../models/PasswordResetToken");
const User = require("../models/User");
const { sendMail } = require("../utils/mailer");

const TOKEN_TTL_MINUTES = 60;

// Always answer /forgot-password with the same message. Saying "no such account"
// would turn the endpoint into an oracle for which emails are registered.
const GENERIC_RESPONSE = {
  message: "If that email is registered, a password reset link has been sent."
};

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function resetLink(rawToken) {
  const base = process.env.CLIENT_ORIGIN || "http://localhost:3000";
  return `${base}/reset-password?token=${rawToken}`;
}

async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ where: { email } });

    // Unknown address, or a suspended account: respond identically and stop.
    if (!user || user.status !== "active") {
      return res.json(GENERIC_RESPONSE);
    }

    // Retire any outstanding tokens so only the newest link works.
    await PasswordResetToken.update(
      { usedAt: new Date() },
      { where: { userId: user.id, usedAt: null } }
    );

    const rawToken = crypto.randomBytes(32).toString("hex");
    await PasswordResetToken.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)
    });

    await sendMail({
      to: user.email,
      subject: "Reset your Excel Connect Hub password",
      text: [
        `Hello ${user.name},`,
        "",
        "We received a request to reset your password. Open the link below to choose a new one:",
        "",
        resetLink(rawToken),
        "",
        `This link expires in ${TOKEN_TTL_MINUTES} minutes and can only be used once.`,
        "If you did not request this, you can ignore this email — your password will not change."
      ].join("\n")
    });

    res.json(GENERIC_RESPONSE);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    const record = await PasswordResetToken.findOne({
      where: {
        tokenHash: hashToken(String(token)),
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [{ model: User, as: "user" }]
    });

    if (!record || !record.user) {
      return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new one." });
    }

    if (record.user.status !== "active") {
      return res.status(403).json({ message: "Account is suspended" });
    }

    // The User beforeUpdate hook re-hashes the password on change.
    await record.user.update({ password });

    // Burn the token, and any siblings, so a link cannot be replayed.
    await PasswordResetToken.update(
      { usedAt: new Date() },
      { where: { userId: record.userId, usedAt: null } }
    );

    res.json({ message: "Password updated. You can now log in with your new password." });
  } catch (error) {
    next(error);
  }
}

module.exports = { forgotPassword, resetPassword };
