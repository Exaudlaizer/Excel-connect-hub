/**
 * Billing configuration and the canonical plan catalogue.
 *
 * The plans live here as the source of truth and are pushed into the database
 * by `npm run seed:plans`. Keeping them in code means the catalogue is
 * reviewable and version-controlled; the database copy is what the app reads at
 * runtime so an admin can adjust a price without a deploy.
 *
 * Everything is free today. `paymentsEnabled()` gates the checkout flow: while
 * it returns false, the plans are visible and the Free plan is fully active, but
 * any attempt to actually pay is turned away with "coming soon" rather than
 * reaching the gateway. Flip PAYMENTS_ENABLED=true (with Flutterwave keys set)
 * to switch it on.
 */

// Prices are in minor units. TZS has no minor unit in circulation, so these are
// whole shillings × 100 — the ×100 convention is kept so a future USD plan does
// not need a special case.
const PLANS = [
  {
    key: "free",
    name: "Free",
    description: "Everything a student needs, and enough for any account to get started.",
    audience: "all",
    priceMinor: 0,
    currency: "TZS",
    interval: "month",
    sortOrder: 0,
    features: [
      "Full access to learning, opportunities and community",
      "Apply to opportunities and enrol in courses",
      "One active advertisement (businesses)",
      "Standard placement in listings"
    ]
  },
  {
    key: "business_pro",
    name: "Business Pro",
    description: "For businesses that want to reach students at scale.",
    audience: "business",
    priceMinor: 2_500_000, // TZS 25,000 / month
    currency: "TZS",
    interval: "month",
    sortOrder: 1,
    features: [
      "Unlimited advertisements",
      "Featured placement in the catalogue",
      "Priority review of submissions",
      "Basic reach analytics"
    ]
  },
  {
    key: "employer_pro",
    name: "Employer Pro",
    description: "For companies hiring students and recent graduates.",
    audience: "company",
    priceMinor: 3_500_000, // TZS 35,000 / month
    currency: "TZS",
    interval: "month",
    sortOrder: 2,
    features: [
      "Unlimited job and internship postings",
      "Featured and promoted listings",
      "Priority review of postings",
      "Applicant pipeline analytics"
    ]
  },
  {
    key: "mentor_pro",
    name: "Mentor Pro",
    description: "For mentors publishing courses to a wider audience.",
    audience: "mentor",
    priceMinor: 2_000_000, // TZS 20,000 / month
    currency: "TZS",
    interval: "month",
    sortOrder: 3,
    features: [
      "Unlimited published courses",
      "Featured placement in the learning hub",
      "Priority review of courses",
      "Enrolment analytics"
    ]
  }
];

function paymentsEnabled() {
  return process.env.PAYMENTS_ENABLED === "true";
}

// The gateway is only usable when the flag is on AND the keys are present, so a
// half-configured environment cannot accidentally send a user to a broken
// checkout.
function flutterwaveConfigured() {
  return Boolean(process.env.FLW_SECRET_KEY && process.env.FLW_PUBLIC_KEY);
}

module.exports = { PLANS, paymentsEnabled, flutterwaveConfigured };
