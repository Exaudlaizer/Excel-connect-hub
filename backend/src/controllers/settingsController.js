const SiteSetting = require("../models/SiteSetting");
const { removeUploads } = require("./uploadController");

/**
 * Site settings, starting with branding backgrounds.
 *
 * The editable keys are declared here as a catalogue, so the admin UI is driven
 * by data rather than a hand-maintained form, and adding the next branding slot
 * (a logo, a different page's backdrop) is one entry here plus nothing else.
 *
 * Each value is a small object. For an image it is `{ url }`; keeping it an
 * object rather than a bare string means an image can later carry an alt text or
 * a focal point without changing the shape stored in the database.
 */
const SETTINGS = {
  authBackground: {
    label: "Sign-in background",
    description: "Shown behind the login, sign-up and password pages.",
    type: "image",
    isPublic: true
  },
  landingBackground: {
    label: "Landing hero background",
    description: "Shown behind the hero on the public landing page.",
    type: "image",
    isPublic: true
  },
  dashboardBackground: {
    label: "Dashboard backdrop",
    description: "A subtle backdrop behind the signed-in dashboard.",
    type: "image",
    isPublic: false
  }
};

const KEYS = Object.keys(SETTINGS);

function shape(rows) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  // Always return the full catalogue, so a key that has never been set still
  // appears (empty) for the admin form and resolves to a sane default elsewhere.
  return KEYS.map((key) => ({
    key,
    ...SETTINGS[key],
    value: byKey[key] || {}
  }));
}

// Public read: only the keys marked public, and only their values. Used by the
// login page and landing page, which run before anyone is authenticated.
async function publicSettings(_req, res, next) {
  try {
    const publicKeys = KEYS.filter((key) => SETTINGS[key].isPublic);
    const rows = await SiteSetting.findAll({ where: { key: publicKeys } });
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    const result = {};
    for (const key of publicKeys) result[key] = byKey[key] || {};
    res.json({ settings: result });
  } catch (error) {
    next(error);
  }
}

// Admin read: the whole catalogue, including keys never set and non-public ones.
async function listSettings(_req, res, next) {
  try {
    const rows = await SiteSetting.findAll();
    res.json({ settings: shape(rows) });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin write. Validates the key against the catalogue, and for an image
 * setting swaps in the new URL — cleaning up the previous uploaded file if it
 * was one of ours, so replacing a background does not leave the old image
 * orphaned on disk.
 */
async function updateSetting(req, res, next) {
  try {
    const { key } = req.params;
    const definition = SETTINGS[key];
    if (!definition) return res.status(404).json({ message: "Unknown setting" });

    let value = req.body.value;

    if (definition.type === "image") {
      const url = typeof req.body.url === "string" ? req.body.url.trim() : "";
      // Only http(s) URLs are stored; a javascript:/data: value would later be
      // rendered into a CSS background and must never reach that point.
      if (url && !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ message: "Enter a valid image link, or upload a file." });
      }
      value = url ? { url } : {};
    }

    const existing = await SiteSetting.findByPk(key);

    const [row] = await SiteSetting.upsert({
      key,
      value,
      isPublic: definition.isPublic,
      updatedById: req.user.id
    });

    // Retire the file the previous value pointed at, if we hosted it.
    const oldUrl = existing?.value?.url;
    const newUrl = value?.url;
    if (oldUrl && oldUrl !== newUrl) removeUploads([oldUrl]);

    res.json({ setting: { key, ...definition, value: row?.value ?? value } });
  } catch (error) {
    next(error);
  }
}

module.exports = { publicSettings, listSettings, updateSetting, SETTINGS };
