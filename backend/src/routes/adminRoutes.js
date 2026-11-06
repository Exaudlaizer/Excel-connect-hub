const express = require("express");
const { analytics, listAudit } = require("../controllers/adminController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/analytics", protect, authorize("admin"), analytics);
router.get("/audit", protect, authorize("admin"), listAudit);

module.exports = router;
