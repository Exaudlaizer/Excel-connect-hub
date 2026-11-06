/**
 * Optional error reporting to Sentry.
 *
 * Does nothing unless SENTRY_DSN is set, so the code is safe to run without an
 * account. When it is on, reports are scrubbed first: no request headers,
 * cookies, bodies, query strings or user details are sent, only the error, its
 * stack and a few non-sensitive fields (request id, method, path, status).
 */

let client = null;

/** Removes anything that could carry a credential or personal data. */
function scrubEvent(event) {
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
  }
  delete event.user;
  return event;
}

function init({ dsn = process.env.SENTRY_DSN, sentry } = {}) {
  if (!dsn) return false;
  const Sentry = sentry || require("@sentry/node");
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    beforeSend: scrubEvent
  });
  client = Sentry;
  return true;
}

function captureException(error, context = {}) {
  if (!client) return false;
  try {
    client.captureException(error, { extra: context });
    return true;
  } catch (_error) {
    return false;
  }
}

async function flush(timeoutMs = 2000) {
  if (!client) return;
  try {
    await client.flush(timeoutMs);
  } catch (_error) {
    // Shutting down anyway.
  }
}

// For tests: swap or remove the client without touching the environment.
function _setClient(next) {
  client = next;
}

module.exports = { init, captureException, flush, scrubEvent, _setClient };
