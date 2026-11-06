const { local } = require("./local");
const { createSupabaseStorage } = require("./supabase");

/**
 * Image storage drivers. STORAGE_DRIVER selects where NEW uploads go:
 *
 *   local     (default) files on this server's disk, served at /uploads
 *   supabase  a public Supabase Storage bucket
 *
 * Deleting is different: an image is removed from whichever store actually holds
 * it, so switching drivers later does not strand the old files. See
 * `ownerOf()`.
 */

const NAMES = ["local", "supabase"];
const SUPABASE_ENV = ["SUPABASE_URL", "SUPABASE_BUCKET"];

const driverName = (env = process.env) => (env.STORAGE_DRIVER || "local").trim().toLowerCase();
const knownDrivers = () => NAMES.slice();

/** Settings the Supabase driver needs that are not set. */
function missingSupabaseEnv(env = process.env) {
  const missing = SUPABASE_ENV.filter((key) => !env[key]);
  if (!env.SUPABASE_SECRET_KEY && !env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SECRET_KEY");
  return missing;
}

let supabaseCache;
function supabase(env = process.env) {
  // Rebuilt when the settings change (tests do that); cached otherwise.
  const signature = `${env.SUPABASE_URL}|${env.SUPABASE_BUCKET}|${env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY}`;
  if (!supabaseCache || supabaseCache.signature !== signature) {
    supabaseCache = { signature, driver: createSupabaseStorage({ env }) };
  }
  return supabaseCache.driver;
}

/** The driver new uploads are written to. Throws if it is selected but not configured. */
function getStorage(env = process.env) {
  const name = driverName(env);
  if (name === "local") return local;
  if (name === "supabase") {
    const missing = missingSupabaseEnv(env);
    if (missing.length) throw new Error(`STORAGE_DRIVER=supabase is missing configuration: ${missing.join(", ")}.`);
    return supabase(env);
  }
  throw new Error(`Unknown STORAGE_DRIVER "${name}". Available: ${NAMES.join(", ")}.`);
}

/** Every driver that could hold a file, for cleanup. Supabase only when configured. */
function allStorages(env = process.env) {
  return missingSupabaseEnv(env).length ? [local] : [local, supabase(env)];
}

/** Finds which store a stored URL belongs to: { storage, key }, or null if it is not ours. */
function ownerOf(url, env = process.env) {
  for (const storage of allStorages(env)) {
    const key = storage.keyFromUrl(url);
    if (key) return { storage, key };
  }
  return null;
}

module.exports = { getStorage, allStorages, ownerOf, driverName, knownDrivers, missingSupabaseEnv };
