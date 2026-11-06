const User = require("../models/User");
const { sendMail } = require("./mailer");

/**
 * Emails the people who run the platform when something needs a human.
 *
 * Recipients: the addresses in ALERT_EMAILS if set, otherwise every active admin
 * whose email is verified. One email per `key` per 15 minutes, so a burst of the
 * same problem produces one message, not hundreds. The throttle lives in this
 * process; with several instances an operator may occasionally get one message
 * per instance, which is acceptable.
 *
 * It never throws, and what goes in `text` must be safe to email: ids and
 * amounts, never tokens, passwords or secrets.
 */

const THROTTLE_MS = 15 * 60 * 1000;
const EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;

const lastSent = new Map();
const inflight = new Set();

function configuredRecipients() {
  return String(process.env.ALERT_EMAILS || "")
    .split(/[,;\s]+/)
    .map((value) => value.trim())
    .filter((value) => EMAIL.test(value));
}

async function recipients() {
  const configured = configuredRecipients();
  if (configured.length) return configured;
  const admins = await User.findAll({
    where: { role: "admin", status: "active", emailVerified: true },
    attributes: ["email"]
  });
  return admins.map((admin) => admin.email);
}

async function deliver({ key, subject, text, now }) {
  const previous = lastSent.get(key);
  if (previous !== undefined && now - previous < THROTTLE_MS) return { sent: 0, throttled: true };
  // Marked before sending so a slow or failing send cannot cause a storm.
  lastSent.set(key, now);

  console.error(JSON.stringify({ level: "alert", key, subject }));

  const to = await recipients();
  if (!to.length) {
    console.error(JSON.stringify({ level: "warn", message: "operator alert had no recipient", key }));
    return { sent: 0, throttled: false, noRecipients: true };
  }

  let sent = 0;
  for (const address of to) {
    try {
      await sendMail({
        to: address,
        subject: `[Excel Connect Hub] ${subject}`,
        text: `${text}\n\nThis is an automatic message from the Excel Connect Hub API. Similar alerts are limited to one every 15 minutes.`
      });
      sent += 1;
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: "operator alert could not be sent", key, error: error.message }));
    }
  }
  return { sent, throttled: false };
}

function alertOperators({ key, subject, text, now = Date.now() }) {
  const job = deliver({ key, subject, text, now }).catch((error) => {
    console.error(JSON.stringify({ level: "error", message: "operator alert failed", key, error: error.message }));
    return { sent: 0, error: true };
  });
  inflight.add(job);
  job.finally(() => inflight.delete(job));
  return job;
}

/** Resolves once every alert started so far has finished (used at shutdown and in tests). */
async function flushAlerts() {
  await Promise.all([...inflight]);
}

function resetAlertThrottle() {
  lastSent.clear();
}

module.exports = { alertOperators, flushAlerts, resetAlertThrottle, configuredRecipients, THROTTLE_MS };
