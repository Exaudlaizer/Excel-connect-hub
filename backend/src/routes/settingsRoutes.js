const express = require("express");
const { listSettings, publicSettings, updateSetting } = require("../controllers/settingsController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Read by the login and landing pages before anyone is signed in.
router.get("/public", publicSettings);

// Admin-only management.
router.get("/", protect, authorize("admin"), listSettings);
router.put("/:key", protect, authorize("admin"), updateSetting);

module.exports = router;
