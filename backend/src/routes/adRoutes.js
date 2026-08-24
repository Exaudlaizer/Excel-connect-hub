const express = require("express");
const { body } = require("express-validator");
const { createAd, deleteAd, listAds, myAds, updateAd, updateAdStatus } = require("../controllers/adController");
const { authorize, optionalProtect, protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

const CATEGORIES = ["technology", "food", "fashion", "events", "services", "housing", "other"];

// `isURL` defaults to requiring a TLD, which rejects the http://localhost:PORT
// URLs our own upload endpoint returns in development. Naming the protocols at
// the same time is a tightening: javascript: and data: URLs are refused, and
// these values end up in an img src or an href.
const URL_OPTIONS = { protocols: ["http", "https"], require_protocol: true, require_tld: false };

// `{ values: "falsy" }` so an empty optional field from the form is skipped
// rather than failing URL validation.
const writeValidators = [
  body("title").trim().isLength({ min: 3 }).withMessage("Title is required"),
  body("businessName").optional({ values: "falsy" }).trim().isLength({ max: 255 }),
  body("category").isIn(CATEGORIES).withMessage("Invalid category"),
  body("description").trim().isLength({ min: 10 }).withMessage("Description is required"),
  body("contact").trim().notEmpty().withMessage("Contact is required"),
  body("price").optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("imageUrl").optional({ values: "falsy" }).isURL(URL_OPTIONS).withMessage("Enter a valid image link"),
  body("logoUrl").optional({ values: "falsy" }).isURL(URL_OPTIONS).withMessage("Enter a valid logo link"),
  body("linkUrl").optional({ values: "falsy" }).isURL(URL_OPTIONS).withMessage("Enter a valid destination link")
];

router.get("/", optionalProtect, listAds);
router.get("/mine", protect, myAds);

router.post("/", protect, authorize("student", "company", "mentor", "admin"), writeValidators, validate, createAd);
router.patch("/:id", protect, writeValidators, validate, updateAd);
router.delete("/:id", protect, deleteAd);

router.patch(
  "/:id/approval",
  protect,
  authorize("admin"),
  [body("status").isIn(["approved", "rejected", "expired"]).withMessage("Invalid status")],
  validate,
  updateAdStatus
);

module.exports = router;
