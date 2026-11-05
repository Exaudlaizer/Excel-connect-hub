/**
 * Development and test gateway. It moves no money.
 *
 * It returns a redirect straight back to our own return page, and "verifies"
 * any reference as successful for exactly the amount the caller expects — so the
 * caller's amount/currency check always passes here. That is what makes it
 * useful for exercising the whole flow offline, and exactly why it must never
 * run in production (payments/index.js refuses to select it there).
 */

module.exports = {
  name: "mock",
  requiredEnv: [],

  async createPayment({ txRef, redirectUrl }) {
    const url = new URL(redirectUrl);
    url.searchParams.set("mock", "1");
    url.searchParams.set("status", "successful");
    url.searchParams.set("tx_ref", txRef);
    url.searchParams.set("transaction_id", `mock_${txRef}`);
    return { link: url.toString(), providerId: `mock_${txRef}` };
  },

  async verifyPayment({ providerId, expectedMinor, expectedCurrency }) {
    return {
      ok: true,
      status: "successful",
      amountMinor: expectedMinor,
      currency: expectedCurrency,
      providerId
    };
  },

  // There is no signature to check. Safe only because the mock cannot be selected
  // in production.
  verifyWebhook() {
    return true;
  },

  parseWebhook(body) {
    const data = body?.data || {};
    return { txRef: data.tx_ref || body?.txRef, providerId: data.id ? String(data.id) : undefined };
  }
};
