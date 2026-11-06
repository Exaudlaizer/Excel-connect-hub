const crypto = require("crypto");
const multer = require("multer");
const { detectImageType, EXTENSIONS } = require("../utils/imageSignature");
const { local, UPLOAD_DIR, GENERATED_NAME } = require("../storage/local");
const { allStorages, getStorage, ownerOf } = require("../storage");

/**
 * Image upload for the admin panel and advertisement forms.
 *
 * Where the bytes end up (this server's disk or a Supabase bucket) is the storage
 * driver's business; see src/storage. What matters for safety lives here:
 *
 *   1. The stored name is generated, never taken from the client. A name like
 *      "../../server.js" would otherwise decide where the file is written.
 *   2. The file's type is decided by its CONTENT, not by the label the browser
 *      sent. A script renamed ".png" is refused because its bytes are not an
 *      image, and the extension comes from the detected type, never the client.
 *   3. SVG is refused outright: it can carry script and would run in the origin
 *      that serves it.
 *   4. Size is capped by multer before the whole body is buffered.
 */

const MAX_BYTES = 4 * 1024 * 1024;

// The types the platform accepts; the same set the signature check recognises.
const ALLOWED = new Set(Object.keys(EXTENSIONS));

const uploadImage = multer({
  // Held in memory (capped at 4 MB) so the bytes can be checked before anything
  // is written anywhere.
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    const error = new Error("Only JPG, PNG, WebP, GIF and AVIF images are accepted.");
    error.status = 400;
    cb(error);
  }
}).single("file");

const newName = (mimetype) => `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${EXTENSIONS[mimetype]}`;

// multer reports its own failures through the middleware chain; translating
// them here keeps the client-facing message readable instead of "LIMIT_FILE_SIZE".
function handleUpload(req, res, next) {
  uploadImage(req, res, async (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "That image is larger than 4 MB. Please upload a smaller file." });
      }
      return res.status(error.status || 400).json({ message: error.message || "That file could not be uploaded." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Choose an image to upload." });
    }

    // The label said "image"; check the file agrees.
    const detected = detectImageType(req.file.buffer);
    if (!detected || detected !== req.file.mimetype) {
      return res.status(400).json({ message: "That file is not a valid image. Upload a JPG, PNG, WebP, GIF or AVIF." });
    }

    try {
      const key = newName(detected);
      // Absolute URL so the Next.js app can render it directly: the API and the
      // frontend are served from different origins. Only used by the local driver.
      const baseUrl = process.env.PUBLIC_API_ORIGIN || `${req.protocol}://${req.get("host")}`;
      const saved = await getStorage().save({ key, buffer: req.file.buffer, mimetype: detected, baseUrl });

      res.status(201).json({ url: saved.url, filename: saved.key, size: req.file.size });
    } catch (storageError) {
      // The detail (a status code, a Supabase message) belongs in the log, not in
      // front of the user.
      console.error(JSON.stringify({ level: "error", message: "image could not be stored", error: storageError.message, requestId: req.id }));
      res.status(502).json({ message: "We could not save that image right now. Please try again." });
    }
  });
}

async function removeUpload(req, res, next) {
  try {
    const { filename } = req.params;

    // Reject anything that is not one of our generated names, so this cannot be
    // walked out of the upload directory or aimed at another object.
    if (!GENERATED_NAME.test(filename)) {
      return res.status(400).json({ message: "Invalid file reference" });
    }

    // The active store first, then any other that could hold it (files uploaded
    // before the driver was switched).
    const active = getStorage();
    const stores = [active, ...allStorages().filter((store) => store.name !== active.name)];
    for (const store of stores) {
      if (await store.remove(filename)) return res.json({ message: "File removed" });
    }
    res.status(404).json({ message: "File not found" });
  } catch (error) {
    next(error);
  }
}

/* ---------------------------------------------------------------------------
   Cleanup
   ---------------------------------------------------------------------------
   An uploaded file outlives the record that pointed at it unless something
   deletes it. These helpers are called when a record is removed or its image is
   replaced, so storage tracks what is actually referenced.

   Only files this platform generated are ever touched: a URL that does not belong
   to a known store (say, an ad whose image is hosted elsewhere) is ignored.
   ------------------------------------------------------------------------- */

/** The on-disk filename for a URL, or null if it is not one of ours. */
function localFilename(url) {
  return local.keyFromUrl(url);
}

/**
 * Deletes the files behind the given URLs from whichever store holds each one.
 *
 * Never throws and never rejects: losing a file is not a reason to fail the
 * request that deleted the record, and a missing file is the state we wanted.
 * Resolves to the keys that were removed.
 */
async function removeUploads(urls) {
  const removed = [];

  for (const url of [].concat(urls).filter(Boolean)) {
    try {
      const owner = ownerOf(url);
      if (!owner) continue;
      if (await owner.storage.remove(owner.key)) removed.push(owner.key);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: "could not remove an upload", error: error.message }));
    }
  }

  return removed;
}

module.exports = { handleUpload, removeUpload, removeUploads, localFilename, UPLOAD_DIR };
