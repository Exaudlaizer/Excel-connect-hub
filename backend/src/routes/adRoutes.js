const express = require("express");
const { body } = require("express-validator");
const { createAd, listAds, updateAdStatus } = require("../controllers/adController");
const { authorize, optionalProtect, protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.get("/", optionalProtect, listAds);
router.post(
  "/",
  protect,
  authorize("student", "company", "admin"),
  [
    body("title").trim().isLength({ min: 3 }).withMessage("Title is required"),
    body("category").isIn(["technology", "food", "fashion", "events", "services", "housing", "other"]).withMessage("Invalid category"),
    body("description").trim().isLength({ min: 10 }).withMessage("Description is required"),
    body("contact").trim().notEmpty().withMessage("Contact is required")
  ],
  validate,
  createAd
);
router.patch(
  "/:id/approval",
  protect,
  authorize("admin"),
  [body("status").isIn(["approved", "rejected", "expired"]).withMessage("Invalid status")],
  validate,
  updateAdStatus
);

module.exports = router;
