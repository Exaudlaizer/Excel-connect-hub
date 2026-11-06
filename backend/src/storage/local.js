const fs = require("fs");
const path = require("path");

/**
 * Local-disk image storage. Files live in UPLOAD_DIR and are served read-only by
 * the API at /uploads. Fine for one server with a persistent disk; it does not
 * survive a rebuild of an ephemeral container and is not shared between
 * instances, which is why STORAGE_DRIVER=supabase exists.
 *
 * Interface (shared with storage/supabase.js):
 *   name
 *   save({ key, buffer, mimetype, baseUrl }) -> { url, key }
 *   remove(key)                              -> boolean (false if it was not there)
 *   keyFromUrl(url)                          -> key, or null if the URL is not ours
 */

// Overridable so tests can write to a throwaway directory.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");

// Only names this server generates are ever read, written or deleted.
const GENERATED_NAME = /^[0-9]+-[0-9a-f]{16}\.(jpg|png|webp|gif|avif)$/;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const local = {
  name: "local",

  async save({ key, buffer, baseUrl }) {
    if (!GENERATED_NAME.test(key)) throw new Error("refusing to store a file under an unexpected name");
    // "wx": never overwrite an existing file.
    await fs.promises.writeFile(path.join(UPLOAD_DIR, key), buffer, { flag: "wx" });
    return { url: `${baseUrl}/uploads/${key}`, key };
  },

  async remove(key) {
    if (!GENERATED_NAME.test(key)) return false;
    try {
      await fs.promises.unlink(path.join(UPLOAD_DIR, key));
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  },

  keyFromUrl(url) {
    if (!url || typeof url !== "string") return null;
    const marker = "/uploads/";
    const index = url.indexOf(marker);
    if (index === -1) return null;
    const name = url.slice(index + marker.length).split(/[?#]/)[0];
    return GENERATED_NAME.test(name) ? name : null;
  }
};

module.exports = { local, UPLOAD_DIR, GENERATED_NAME };
