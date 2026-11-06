const { GENERATED_NAME } = require("./local");

/**
 * Supabase Storage driver (shared interface: see storage/local.js).
 *
 * Written from Supabase's own documentation and API reference, read on
 * 2026-11-06:
 *   - upload      POST   {url}/storage/v1/object/{bucket}/{path}  raw bytes, Content-Type
 *                        header sets the type; an existing path is a 400 unless x-upsert
 *   - public URL  GET    {url}/storage/v1/object/public/{bucket}/{path}   (public bucket)
 *   - delete      DELETE {url}/storage/v1/object/{bucket}/{path}  -> 200 {"message":...}
 *   - secret keys (sb_secret_...) are not JWTs and go in the `apikey` header only;
 *     the legacy service_role key is a JWT and is sent on both headers
 *   - errors are JSON {statusCode, error, message, code}
 *
 * NOT yet exercised against a real Supabase project. The tests use a stand-in
 * for fetch, so they prove this code sends what the documentation says, not that
 * Supabase accepts it. Check it once against a real bucket.
 *
 * The key is a secret that bypasses every access rule on the project: it lives
 * only in the API's environment and is never sent to the browser or logged.
 */

const TIMEOUT_MS = 15000;

function createSupabaseStorage({ env = process.env, fetchImpl = (...args) => fetch(...args) } = {}) {
  const base = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const bucket = env.SUPABASE_BUCKET;
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  const objectUrl = (key) => `${base}/storage/v1/object/${bucket}/${key}`;
  const publicPrefix = `${base}/storage/v1/object/public/${bucket}/`;

  function headers(extra = {}) {
    return {
      apikey: secret,
      // Legacy service_role keys are JWTs and are also sent as a bearer token;
      // the newer sb_secret_ keys must NOT be.
      ...(String(secret).startsWith("eyJ") ? { Authorization: `Bearer ${secret}` } : {}),
      // Secret keys are refused for browser user agents; this is a server.
      "User-Agent": "excel-connect-hub-api",
      ...extra
    };
  }

  // A failure message that is safe to log: status and Supabase's own message,
  // never the key or the request.
  async function failure(response, what) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.message || body.error || "";
    } catch (_error) {
      // Not JSON; the status alone will do.
    }
    const error = new Error(`Supabase Storage ${what} failed (${response.status})${detail ? `: ${detail}` : ""}`);
    error.status = response.status;
    return error;
  }

  return {
    name: "supabase",

    async save({ key, buffer, mimetype }) {
      if (!GENERATED_NAME.test(key)) throw new Error("refusing to store a file under an unexpected name");
      const response = await fetchImpl(objectUrl(key), {
        method: "POST",
        headers: headers({ "Content-Type": mimetype }),
        body: buffer,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!response.ok) throw await failure(response, "upload");
      return { url: `${publicPrefix}${key}`, key };
    },

    async remove(key) {
      if (!GENERATED_NAME.test(key)) return false;
      const response = await fetchImpl(objectUrl(key), {
        method: "DELETE",
        headers: headers(),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (response.status === 404) return false;
      if (!response.ok) throw await failure(response, "delete");
      return true;
    },

    keyFromUrl(url) {
      if (!url || typeof url !== "string" || !url.startsWith(publicPrefix)) return null;
      const name = url.slice(publicPrefix.length).split(/[?#]/)[0];
      return GENERATED_NAME.test(name) ? name : null;
    }
  };
}

module.exports = { createSupabaseStorage };
