const crypto = require("crypto");

/**
 * Flutterwave driver (see payments/index.js for the interface).
 *
 * NOTE: Flutterwave merchant accounts are not available in every country, and
 * the project's own owner cannot onboard in Tanzania. The driver is kept because
 * it is complete and tested against the interface, and is selectable with
 * PAYMENT_PROVIDER=flutterwave for anyone who can use it. Selcom and ClickPesa
 * are the planned Tanzanian drivers.
 *
 * It re-reads the amount and currency from Flutterwave on verify, and compares
 * webhook signatures in constant time.
 */

const BASE = "https://api.flutterwave.com/v3";

module.exports = {
  name: "flutterwave",
  requiredEnv: ["FLW_PUBLIC_KEY", "FLW_SECRET_KEY", "FLW_WEBHOOK_HASH"],

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
  },

  // Flutterwave signs webhooks with the secret hash configured in its dashboard,
  // sent in the `verif-hash` header.
  verifyWebhook(req) {
    const expected = process.env.FLW_WEBHOOK_HASH;
    const received = req.headers["verif-hash"];
    if (!expected || !received) return false;
    const a = Buffer.from(String(received));
    const b = Buffer.from(String(expected));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  parseWebhook(body) {
    const data = body?.data || {};
    return { txRef: data.tx_ref || body?.txRef, providerId: data.id ? String(data.id) : undefined };
  }
};
