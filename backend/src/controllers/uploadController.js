const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

/**
 * Image upload for the admin panel and advertisement forms.
 *
 * Files land on disk under backend/uploads and are served read-only from
 * /uploads. Three things matter for safety here:
 *
 *   1. The stored filename is generated, never taken from the client. An
 *      uploaded name like "../../server.js" would otherwise decide where the
 *      file is written.
 *   2. The extension comes from a fixed table keyed on the detected MIME type,
 *      so a ".html" or ".svg" cannot be smuggled in and later served inline.
 *   3. Size is capped by multer before the whole body is buffered.
 */

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const MAX_BYTES = 4 * 1024 * 1024;

// SVG is deliberately absent: it can carry script and would execute in the
// origin that serves it.
const ALLOWED = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif"
};

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const extension = ALLOWED[file.mimetype] || ".bin";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`);
  }
});

const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    const error = new Error("Only JPG, PNG, WebP, GIF and AVIF images are accepted.");
    error.status = 400;
    cb(error);
  }
}).single("file");

// multer reports its own failures through the middleware chain; translating
// them here keeps the client-facing message readable instead of "LIMIT_FILE_SIZE".
function handleUpload(req, res, next) {
  uploadImage(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "That image is larger than 4 MB. Please upload a smaller file." });
      }
      return res.status(error.status || 400).json({ message: error.message || "That file could not be uploaded." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Choose an image to upload." });
    }

    // Absolute URL so the Next.js app can render it directly: the API and the
    // frontend are served from different origins in development.
    const base = process.env.PUBLIC_API_ORIGIN || `${req.protocol}://${req.get("host")}`;
    res.status(201).json({
      url: `${base}/uploads/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size
    });
  });
}

function removeUpload(req, res, next) {
  try {
    const { filename } = req.params;

    // Reject anything that is not one of our generated names, so this cannot be
    // walked out of the upload directory.
    if (!/^[0-9]+-[0-9a-f]{16}\.(jpg|png|webp|gif|avif)$/.test(filename)) {
      return res.status(400).json({ message: "Invalid file reference" });
    }

    const target = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(target)) return res.status(404).json({ message: "File not found" });

    fs.unlinkSync(target);
    res.json({ message: "File removed" });
  } catch (error) {
    next(error);
  }
}

/* ---------------------------------------------------------------------------
   Cleanup
   ---------------------------------------------------------------------------
   An uploaded file outlives the record that pointed at it unless something
   deletes it. These helpers are called when a record is removed or its image is
   replaced, so the directory tracks what is actually referenced.

   Only files this server generated are ever touched: `localFilename` returns
   null for an external URL, so deleting an ad whose image is hosted elsewhere
   does not try to unlink anything.
   ------------------------------------------------------------------------- */

const GENERATED_NAME = /^[0-9]+-[0-9a-f]{16}\.(jpg|png|webp|gif|avif)$/;

/** The on-disk filename for a URL, or null if it is not one of ours. */
function localFilename(url) {
  if (!url || typeof url !== "string") return null;

  const marker = "/uploads/";
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const name = url.slice(index + marker.length).split(/[?#]/)[0];
  return GENERATED_NAME.test(name) ? name : null;
}

/**
 * Deletes the files behind the given URLs, ignoring anything not ours.
 *
 * Never throws: losing a file is not a reason to fail the request that deleted
 * the record, and a missing file is the state we wanted anyway.
 */
function removeUploads(urls) {
  const removed = [];

  for (const url of [].concat(urls).filter(Boolean)) {
    const name = localFilename(url);
    if (!name) continue;

    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, name));
      removed.push(name);
    } catch (error) {
      if (error.code !== "ENOENT") console.error(`Could not remove upload ${name}: ${error.message}`);
    }
  }

  return removed;
}

module.exports = { handleUpload, removeUpload, removeUploads, localFilename, UPLOAD_DIR };
