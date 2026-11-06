const crypto = require("crypto");

/**
 * Payment providers.
 *
 * A gateway is a driver behind one small interface, so changing or adding one
 * is a new file here, not a rewrite of billing:
 *
 *   name                                  stored on Payment/Subscription rows
 *   requiredEnv                           variables that must all be set to use it
 *   createPayment({ txRef, amountMinor, currency, redirectUrl, customer, meta })
 *                                         -> { link, providerId }
 *   verifyPayment({ providerId, expectedMinor, expectedCurrency })
 *                                         -> { ok, status, amountMinor, currency, providerId }
 *   verifyWebhook(req)                    -> boolean (is this really from the gateway?)
 *   parseWebhook(body)                    -> { txRef, providerId }
 *
 * The rule every driver must honour, and billingController relies on: verify
 * asks the gateway directly and reports the amount and currency IT recorded.
 * Webhooks and browser redirects are only hints to go and check a reference.
 *
 * Selected with PAYMENT_PROVIDER. Unset means "mock" — a development gateway that
 * moves no money and is refused in production.
 */

const DRIVERS = {
  mock: require("./mock"),
  flutterwave: require("./flutterwave")
};

function providerName() {
  return (process.env.PAYMENT_PROVIDER || "mock").trim().toLowerCase();
}

function knownProviders() {
  return Object.keys(DRIVERS);
}

function missingEnv(driver) {
  return driver.requiredEnv.filter((key) => !process.env[key]);
}

/**
 * Looks a driver up by the name stored on a Payment row. A payment is always
 * verified with the provider that created it, even if the active provider has
 * since changed.
 */
function getProviderByName(name) {
  const driver = DRIVERS[name];
  if (!driver) throw new Error(`Unknown payment provider "${name}". Available: ${knownProviders().join(", ")}.`);

  // Second lock behind config validation: the mock approves any amount it is
  // asked about, so it must never run in production.
  if (driver.name === "mock" && process.env.NODE_ENV === "production") {
    throw new Error("The mock payment gateway is disabled in production. Set PAYMENT_PROVIDER to a real gateway.");
  }

  const missing = missingEnv(driver);
  if (missing.length) {
    throw new Error(`Payment provider "${name}" is missing configuration: ${missing.join(", ")}.`);
  }
  return driver;
}

function getProvider() {
  return getProviderByName(providerName());
}

/** A unique, traceable reference for one payment attempt. */
function newTxRef() {
  return `ech-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

module.exports = { getProvider, getProviderByName, providerName, knownProviders, missingEnv, newTxRef, DRIVERS };
