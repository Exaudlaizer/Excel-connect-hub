const express = require("express");
const { body } = require("express-validator");
const { listUsers, updateMe, updateUserStatus } = require("../controllers/userController");
const { authorize, protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.get("/", protect, authorize("admin"), listUsers);
router.patch("/me", protect, updateMe);
router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  [body("status").isIn(["active", "suspended"]).withMessage("Invalid status")],
  validate,
  updateUserStatus
);

module.exports = router;
