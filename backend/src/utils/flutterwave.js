const crypto = require("crypto");
const { flutterwaveConfigured } = require("../config/billing");

/**
 * Flutterwave payment provider, with a mock driver for when no keys are set.
 *
 * Flutterwave is the fit for this platform: it settles in Tanzania and supports
 * mobile money (M-Pesa, Tigo Pesa, Airtel) alongside cards, which is how most
 * students and small businesses here actually pay.
 *
 * Two things this module is careful about:
 *
 *   1. The verify step re-reads the amount and currency from Flutterwave and the
 *      caller checks them against what was expected. A webhook body can be
 *      forged; a server-to-server verify against the provider cannot, so the
 *      subscription is only granted on what verify returns, never on what the
 *      webhook claimed.
 *
 *   2. Webhook signatures are compared in constant time.
 *
 * With no keys configured the mock driver stands in, so the whole flow — create,
 * redirect, webhook, verify, grant — can be exercised end to end in development
 * and in tests without touching a real account or moving real money.
 */

const BASE = "https://api.flutterwave.com/v3";

function usingMock() {
  return !flutterwaveConfigured();
}

/** A unique, traceable reference for one payment attempt. */
function newTxRef() {
  return `ech-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

/* ---------------------------------------------------------------------------
   Mock driver
   ---------------------------------------------------------------------------
   Returns a redirect URL pointing back at our own sandbox-complete endpoint,
   and "verifies" any reference it was told about as successful for the amount
   the payment row recorded. It never invents a success for an unknown ref.
   ------------------------------------------------------------------------- */
const mock = {
  async createPayment({ txRef, amountMinor, currency, redirectUrl }) {
    const url = new URL(redirectUrl);
    url.searchParams.set("mock", "1");
    url.searchParams.set("status", "successful");
    url.searchParams.set("tx_ref", txRef);
    url.searchParams.set("transaction_id", `mock_${txRef}`);
    return { link: url.toString(), providerId: `mock_${txRef}` };
  },

  async verifyPayment({ providerId, expectedMinor, expectedCurrency }) {
    // The mock cannot know the real amount, so it echoes what the caller expects
    // — which means the caller's amount/currency check always passes in dev, and
    // the same check is what protects production.
    return {
      ok: true,
      status: "successful",
      amountMinor: expectedMinor,
      currency: expectedCurrency,
      providerId
    };
  }
};

/* ---------------------------------------------------------------------------
   Live driver
   ------------------------------------------------------------------------- */
const live = {
  async createPayment({ txRef, amountMinor, currency, redirectUrl, customer, meta }) {
    const response = await fetch(`${BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amountMinor / 100,
        currency,
        redirect_url: redirectUrl,
        customer: { email: customer.email, name: customer.name },
        customizations: { title: "Excel Connect Hub" },
        meta
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== "success") {
      throw new Error(data.message || "Flutterwave rejected the payment request");
    }
    return { link: data.data.link, providerId: null };
  },

  async verifyPayment({ providerId }) {
    const response = await fetch(`${BASE}/transactions/${providerId}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status !== "success") {
      return { ok: false, status: "failed" };
    }

    const tx = data.data;
    return {
      ok: tx.status === "successful",
      status: tx.status,
      // Convert back to minor units for comparison against what we charged.
      amountMinor: Math.round(Number(tx.amount) * 100),
      currency: tx.currency,
      providerId: String(tx.id)
    };
  }
};

const driver = () => (usingMock() ? mock : live);

async function createPayment(args) {
  return driver().createPayment(args);
}

async function verifyPayment(args) {
  return driver().verifyPayment(args);
}

/**
 * Confirms a webhook really came from Flutterwave.
 *
 * Flutterwave signs its webhooks with the secret hash you configure in the
 * dashboard, sent in the `verif-hash` header. The mock has no signature, so in
 * mock mode the webhook path is not the trusted source anyway — verify is.
 */
function verifyWebhookSignature(headerHash) {
  const expected = process.env.FLW_WEBHOOK_HASH;
  if (!expected) return usingMock(); // no hash configured: only trust in dev

  if (!headerHash) return false;
  const a = Buffer.from(String(headerHash));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { newTxRef, createPayment, verifyPayment, verifyWebhookSignature, usingMock };
