const crypto = require("crypto");
const { Op } = require("sequelize");
const OtpCode = require("../models/OtpCode");
const User = require("../models/User");
const { otpTemplate, sendMail } = require("../utils/mailer");

/**
 * One-time verification codes for email and phone.
 *
 * Both purposes deliver to the account's email address. The platform has no SMS
 * gateway, so a phone number is confirmed by the account owner receiving a code
 * at their verified email and entering it — which proves control of the account
 * and records that the number was deliberately confirmed, not that the handset
 * was reached. That distinction is stated in the UI rather than glossed over.
 */

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
// A new code invalidates the previous one, so this also bounds how many live
// codes can exist for an account: exactly one per purpose.
const RESEND_COOLDOWN_SECONDS = 60;

function generateCode() {
  // randomInt is uniform over the range; `Math.random() * 900000` is not, and a
  // predictable code is the whole ballgame here.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

/** The value a given purpose is confirming. */
function targetFor(user, purpose) {
  return purpose === "phone" ? (user.phone || "").trim() : user.email;
}

function alreadyVerified(user, purpose) {
  return purpose === "phone" ? Boolean(user.phoneVerified) : Boolean(user.emailVerified);
}

/**
 * Issues a code and emails it.
 *
 * Returns `{ sent: false, reason }` rather than throwing when the request is
 * legitimate but should not produce a code (nothing to verify, already
 * verified, still within the cooldown), so callers can decide how much to tell
 * the client.
 */
async function issueCode(user, purpose) {
  const target = targetFor(user, purpose);

  if (!target) return { sent: false, reason: "no-target" };
  if (alreadyVerified(user, purpose)) return { sent: false, reason: "already-verified" };

  const live = await OtpCode.findOne({
    where: { userId: user.id, purpose, consumedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [["createdAt", "DESC"]]
  });

  if (live) {
    const age = (Date.now() - new Date(live.createdAt).getTime()) / 1000;
    if (age < RESEND_COOLDOWN_SECONDS) {
      return { sent: false, reason: "cooldown", retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - age) };
    }
  }

  // Retire every outstanding code for this purpose before minting a new one, so
  // an older message cannot still be used after a resend.
  await OtpCode.update(
    { consumedAt: new Date() },
    { where: { userId: user.id, purpose, consumedAt: null } }
  );

  const code = generateCode();
  await OtpCode.create({
    userId: user.id,
    purpose,
    codeHash: hashCode(code),
    target,
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)
  });

  const message = otpTemplate({
    name: user.name,
    code,
    purpose,
    minutes: CODE_TTL_MINUTES,
    target
  });

  await sendMail({ to: user.email, ...message });
  return { sent: true, expiresInMinutes: CODE_TTL_MINUTES };
}

/* -------------------------------------------------------------------------
   Routes
   ------------------------------------------------------------------------- */

// Authenticated request: the signed-in user asks for a code.
async function requestCode(req, res, next) {
  try {
    const purpose = req.body.purpose === "phone" ? "phone" : "email";
    const result = await issueCode(req.user, purpose);

    if (!result.sent) {
      if (result.reason === "no-target") {
        return res.status(400).json({
          message: "Add a phone number to your profile before requesting a code."
        });
      }
      if (result.reason === "already-verified") {
        return res.status(200).json({
          message: purpose === "phone" ? "Your phone number is already confirmed." : "Your email is already confirmed.",
          alreadyVerified: true
        });
      }
      if (result.reason === "cooldown") {
        return res.status(429).json({
          message: `Please wait ${result.retryAfter} seconds before requesting another code.`,
          retryAfter: result.retryAfter
        });
      }
    }

    res.json({
      message: `We sent a 6-digit code to ${req.user.email}. It expires in ${CODE_TTL_MINUTES} minutes.`,
      sentTo: req.user.email,
      expiresInMinutes: CODE_TTL_MINUTES
    });
  } catch (error) {
    next(error);
  }
}

// Unauthenticated request by email address, for someone who registered and then
// closed the tab. Deliberately non-enumerable: the response is identical
// whether or not that address has an account.
async function requestCodePublic(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ where: { email } });

    if (user && user.status === "active") {
      await issueCode(user, "email");
    }

    res.json({
      message: "If that address needs confirming, a 6-digit code is on its way.",
      expiresInMinutes: CODE_TTL_MINUTES
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Checks a code and, if it matches, marks the value verified.
 *
 * The lookup is by user and purpose rather than by code: searching for a
 * matching hash across the whole table would let anybody who guesses any live
 * code verify whichever account it happened to belong to.
 */
async function verifyCode(user, purpose, submitted) {
  const record = await OtpCode.findOne({
    where: { userId: user.id, purpose, consumedAt: null },
    order: [["createdAt", "DESC"]]
  });

  if (!record) return { ok: false, status: 400, message: "Request a new code — this one is no longer available." };

  if (new Date(record.expiresAt) <= new Date()) {
    return { ok: false, status: 400, message: "That code has expired. Request a new one." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, message: "Too many incorrect attempts. Request a new code." };
  }

  // The value being confirmed must still be the one the code was sent for.
  if (record.target !== targetFor(user, purpose)) {
    return {
      ok: false,
      status: 400,
      message: "That code was sent for a different value. Request a new one."
    };
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(submitted), "hex");
  // Constant-time compare so the response time cannot be used to walk the code
  // out digit by digit.
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    await record.increment("attempts");
    const left = MAX_ATTEMPTS - (record.attempts + 1);
    return {
      ok: false,
      status: 400,
      message: left > 0 ? `That code is not correct. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many incorrect attempts. Request a new code."
    };
  }

  await record.update({ consumedAt: new Date() });
  await user.update(purpose === "phone" ? { phoneVerified: true } : { emailVerified: true });

  return { ok: true };
}

async function confirmCode(req, res, next) {
  try {
    const purpose = req.body.purpose === "phone" ? "phone" : "email";
    const result = await verifyCode(req.user, purpose, req.body.code);

    if (!result.ok) return res.status(result.status).json({ message: result.message });

    res.json({
      message: purpose === "phone" ? "Phone number confirmed." : "Email address confirmed.",
      emailVerified: req.user.emailVerified,
      phoneVerified: req.user.phoneVerified
    });
  } catch (error) {
    next(error);
  }
}

// Unauthenticated confirm, paired with requestCodePublic.
async function confirmCodePublic(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ where: { email } });

    // Same wording as a wrong code, so this cannot be used to discover which
    // addresses are registered.
    if (!user) return res.status(400).json({ message: "That code is not correct or has expired." });

    const result = await verifyCode(user, "email", req.body.code);
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    res.json({ message: "Email address confirmed. You can sign in now.", emailVerified: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  issueCode,
  requestCode,
  requestCodePublic,
  confirmCode,
  confirmCodePublic,
  CODE_TTL_MINUTES,
  RESEND_COOLDOWN_SECONDS
};
