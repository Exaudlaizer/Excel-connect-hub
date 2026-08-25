const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const { paymentsEnabled } = require("../config/billing");
const {
  createPayment,
  newTxRef,
  usingMock,
  verifyPayment,
  verifyWebhookSignature
} = require("../utils/flutterwave");

/**
 * Subscriptions and payments.
 *
 * The design rule that matters here: a subscription is granted only after a
 * server-to-server verify against the gateway confirms the money, and only if
 * the amount and currency verify returns match the plan that was bought. The
 * webhook and the browser redirect are both treated as untrusted hints that say
 * "go and check this reference" — never as proof of payment themselves.
 */

const AUDIENCE_FOR_ROLE = {
  company: ["all", "company", "business"],
  mentor: ["all", "mentor"],
  student: ["all"],
  admin: ["all", "company", "business", "mentor"]
};

async function ensureSubscription(userId) {
  const [subscription] = await Subscription.findOrCreate({
    where: { userId },
    defaults: { userId, planKey: "free", status: "active", provider: "none" }
  });
  return subscription;
}

// Plans, filtered to what this account could actually use. A student is not
// shown Business Pro, because they can never buy it.
async function listPlans(req, res, next) {
  try {
    const allowed = AUDIENCE_FOR_ROLE[req.user?.role] || ["all"];
    const plans = await Plan.findAll({
      where: { isActive: true },
      order: [["sortOrder", "ASC"]]
    });

    res.json({
      plans: plans.filter((plan) => allowed.includes(plan.audience)),
      paymentsEnabled: paymentsEnabled()
    });
  } catch (error) {
    next(error);
  }
}

async function mySubscription(req, res, next) {
  try {
    const subscription = await ensureSubscription(req.user.id);
    const plan = await Plan.findOne({ where: { key: subscription.planKey } });

    res.json({
      subscription,
      plan,
      paymentsEnabled: paymentsEnabled()
    });
  } catch (error) {
    next(error);
  }
}

async function myPayments(req, res, next) {
  try {
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]],
      limit: 50
    });
    res.json({ payments });
  } catch (error) {
    next(error);
  }
}

/**
 * Starts a checkout. Records a pending payment, asks the gateway for a hosted
 * payment link, and hands the link back for the browser to follow.
 *
 * Nothing about the subscription changes here — payment is only recognised once
 * the reference is verified after the user returns.
 */
async function startCheckout(req, res, next) {
  try {
    if (!paymentsEnabled()) {
      return res.status(503).json({
        message: "Paid plans are not available yet. Everything is free for now.",
        comingSoon: true
      });
    }

    const plan = await Plan.findOne({ where: { key: req.body.planKey, isActive: true } });
    if (!plan) return res.status(404).json({ message: "That plan is not available." });
    if (plan.priceMinor === 0) {
      return res.status(400).json({ message: "The Free plan does not require payment." });
    }

    // The plan's audience must match the buyer's role, so a student cannot buy
    // Business Pro by posting its key directly.
    const allowed = AUDIENCE_FOR_ROLE[req.user.role] || ["all"];
    if (!allowed.includes(plan.audience)) {
      return res.status(403).json({ message: "This plan is not available for your account type." });
    }

    const txRef = newTxRef();
    await Payment.create({
      userId: req.user.id,
      planKey: plan.key,
      provider: "flutterwave",
      txRef,
      amountMinor: plan.priceMinor,
      currency: plan.currency,
      status: "pending",
      meta: { planName: plan.name }
    });

    const redirectUrl = `${process.env.CLIENT_ORIGIN || "http://localhost:3000"}/billing/return`;
    const { link, providerId } = await createPayment({
      txRef,
      amountMinor: plan.priceMinor,
      currency: plan.currency,
      redirectUrl,
      customer: { email: req.user.email, name: req.user.name },
      meta: { userId: req.user.id, planKey: plan.key }
    });

    if (providerId) await Payment.update({ providerId }, { where: { txRef } });

    res.json({ link, txRef, mock: usingMock() });
  } catch (error) {
    next(error);
  }
}

/**
 * The one place a subscription is actually granted.
 *
 * Given a reference, it verifies with the gateway, checks the verified amount
 * and currency against the pending payment, and only then upgrades the account.
 * It is idempotent: a payment already marked successful is not processed again,
 * so a duplicate webhook plus a browser return cannot grant two periods.
 */
async function grantFromReference({ txRef, providerId }) {
  const payment = await Payment.findOne({ where: { txRef } });
  if (!payment) return { ok: false, reason: "unknown-reference" };
  if (payment.status === "successful") return { ok: true, already: true };

  const verification = await verifyPayment({
    providerId: providerId || payment.providerId,
    expectedMinor: payment.amountMinor,
    expectedCurrency: payment.currency
  });

  // The amount and currency the gateway confirms must match what we charged for
  // this reference. A mismatch means a tampered redirect, so it is refused and
  // recorded rather than granted.
  const amountMatches =
    verification.ok &&
    verification.amountMinor === payment.amountMinor &&
    verification.currency === payment.currency;

  if (!amountMatches) {
    await payment.update({
      status: "failed",
      meta: { ...payment.meta, verification }
    });
    return { ok: false, reason: "verification-failed" };
  }

  await payment.update({
    status: "successful",
    providerId: verification.providerId || payment.providerId,
    meta: { ...payment.meta, verifiedAt: new Date().toISOString() }
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await ensureSubscription(payment.userId);
  await subscription.update({
    planKey: payment.planKey,
    status: "active",
    provider: "flutterwave",
    providerRef: verification.providerId || payment.providerId,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false
  });

  return { ok: true, planKey: payment.planKey };
}

// Called by the browser when the user returns from the gateway. Its answer is a
// convenience for the UI; the subscription state it reports is still the result
// of a real verify, so it cannot be spoofed by crafting the return URL.
async function confirmReturn(req, res, next) {
  try {
    const result = await grantFromReference({
      txRef: req.body.txRef,
      providerId: req.body.transactionId
    });

    if (!result.ok) {
      return res.status(400).json({
        message:
          result.reason === "verification-failed"
            ? "We could not verify that payment. If you were charged, contact support and nothing will be lost."
            : "We could not find that payment.",
        status: "failed"
      });
    }

    res.json({ message: "Your subscription is active.", status: "active", planKey: result.planKey });
  } catch (error) {
    next(error);
  }
}

// Server-to-server webhook. Verifies the signature, then routes through the same
// verified-grant path as the browser return.
async function webhook(req, res) {
  try {
    if (!verifyWebhookSignature(req.headers["verif-hash"])) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const event = req.body?.data || {};
    const txRef = event.tx_ref || req.body?.txRef;
    const providerId = event.id ? String(event.id) : undefined;

    if (txRef) await grantFromReference({ txRef, providerId });

    // Always 200 to a validly-signed webhook so the gateway stops retrying;
    // whether the grant succeeded is recorded on the payment row.
    res.json({ received: true });
  } catch (error) {
    // Even on an internal error, acknowledge so the provider does not hammer us;
    // the failure is logged for reconciliation.
    console.error("Billing webhook error:", error.message);
    res.json({ received: true });
  }
}

// Downgrade to Free at period end. If there is no paid period (or payments are
// off), it takes effect immediately.
async function cancel(req, res, next) {
  try {
    const subscription = await ensureSubscription(req.user.id);

    if (subscription.planKey === "free") {
      return res.status(400).json({ message: "You are already on the Free plan." });
    }

    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()) {
      await subscription.update({ cancelAtPeriodEnd: true });
      return res.json({
        message: "Your plan will move to Free at the end of the current period.",
        cancelAtPeriodEnd: true
      });
    }

    await subscription.update({
      planKey: "free",
      status: "active",
      provider: "none",
      providerRef: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false
    });
    res.json({ message: "You are now on the Free plan.", planKey: "free" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPlans,
  mySubscription,
  myPayments,
  startCheckout,
  confirmReturn,
  webhook,
  cancel,
  ensureSubscription,
  grantFromReference
};
