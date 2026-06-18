const express = require("express");
const { analytics } = require("../controllers/adminController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/analytics", protect, authorize("admin"), analytics);

module.exports = router;
