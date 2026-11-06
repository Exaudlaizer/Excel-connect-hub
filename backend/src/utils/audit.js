const AuditLog = require("../models/AuditLog");

/**
 * Writes one audit row. Never throws: a failure to record must not turn a
 * successful action into an error for the person who did it, so problems are
 * logged and swallowed.
 *
 * @param req      the request (for the acting user and IP); may be null
 * @param action   dotted name, e.g. "job.status", "user.role", "auth.logout_all"
 * @param target   { type, id } of the thing acted on
 * @param details  small facts only (old/new values). No secrets, tokens or bodies.
 * @param options  { actor } to override req.user (e.g. password reset has no session)
 */
async function recordAudit(req, action, target = {}, details = {}, options = {}) {
  try {
    const actor = options.actor !== undefined ? options.actor : req?.user;
    return await AuditLog.create({
      actorId: actor?.id || null,
      actorEmail: actor?.email || null,
      action,
      targetType: target.type || null,
      targetId: target.id ? String(target.id) : null,
      details,
      ip: req?.ip || null
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "audit write failed", action, error: error.message }));
    return null;
  }
}

module.exports = { recordAudit };
