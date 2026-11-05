/**
 * What an account's plan allows.
 *
 * One place answers "may this user do X?" so the limits advertised in
 * config/billing.js are enforced identically everywhere instead of being
 * re-derived (and drifting) in each controller.
 *
 * `protect` already loads the subscription onto `req.user`, so these helpers
 * take the user and need no extra query.
 */

// A subscription only counts while it is in good standing. Anything else —
// canceled, past due, or a paid period that has ended — falls back to Free.
const ACTIVE_STATUSES = ["active", "trialing"];

const LIMITS = {
  free: { activeAds: 1 },
  business_pro: { activeAds: Infinity },
  // These plans do not change the ad allowance.
  employer_pro: { activeAds: 1 },
  mentor_pro: { activeAds: 1 }
};

function activePlanKey(user, now = new Date()) {
  const subscription = user && user.subscription;
  if (!subscription || !ACTIVE_STATUSES.includes(subscription.status)) return "free";

  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  if (end && end <= now) return "free";

  return LIMITS[subscription.planKey] ? subscription.planKey : "free";
}

// Staff are never rate-limited by a commercial plan.
function limitsFor(user, now = new Date()) {
  if (user && user.role === "admin") return { activeAds: Infinity };
  return LIMITS[activePlanKey(user, now)];
}

module.exports = { activePlanKey, limitsFor, LIMITS };
