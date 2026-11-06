const express = require("express");
const { handleUpload, removeUpload } = require("../controllers/uploadController");
const { authorize, protect, requireVerified } = require("../middleware/authMiddleware");

const router = express.Router();

// Anyone who can publish content can attach an image to it. Anonymous upload is
// never allowed: it would turn the server into open file hosting.
router.post("/", protect, authorize("student", "company", "mentor", "admin"), requireVerified, handleUpload);
router.delete("/:filename", protect, authorize("admin"), removeUpload);

module.exports = router;
