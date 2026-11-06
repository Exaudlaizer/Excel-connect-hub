const jwt = require("jsonwebtoken");

// A login lasts a day and renews itself while the person keeps using the app
// (see RENEW_AFTER_SECONDS in the auth middleware). A stolen token that is not
// being used therefore dies within 24 hours, and can be cancelled sooner with
// revokeTokens().
const DEFAULT_LIFETIME = "24h";

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      // The account's token version at the moment of issue. A mismatch later
      // means the login was cancelled.
      tv: user.tokenVersion || 0
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_LIFETIME
    }
  );
}

/**
 * Cancels every login this account has, on every device, immediately.
 *
 * Done with an atomic SQL increment so two concurrent revocations cannot both
 * write the same value. Call it whenever the credentials or standing of the
 * account change: password reset, suspension, role change, sign out everywhere.
 */
async function revokeTokens(user) {
  await user.increment("tokenVersion");
  await user.reload();
}

module.exports = { signToken, revokeTokens, DEFAULT_LIFETIME };
