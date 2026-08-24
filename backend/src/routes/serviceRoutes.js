const express = require("express");
const { body } = require("express-validator");
const { createService, deleteService, listServices, updateService } = require("../controllers/serviceController");
const { authorize, optionalProtect, protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

const CATEGORIES = ["academic", "career", "wellbeing", "financial", "housing", "technology", "library", "other"];

// See adRoutes: a TLD is not required (localhost uploads), but the protocol is.
const URL_OPTIONS = { protocols: ["http", "https"], require_protocol: true, require_tld: false };

const writeValidators = [
  body("name").trim().isLength({ min: 3, max: 180 }).withMessage("Service name is required"),
  body("description").trim().isLength({ min: 10 }).withMessage("Describe the service in at least 10 characters"),
  body("category").optional().isIn(CATEGORIES).withMessage("Invalid category"),
  body("contactEmail").optional({ values: "falsy" }).isEmail().withMessage("Enter a valid contact email"),
  body("url").optional({ values: "falsy" }).isURL(URL_OPTIONS).withMessage("Enter a valid link"),
  body("status").optional().isIn(["active", "archived"]).withMessage("Invalid status")
];

router.get("/", optionalProtect, listServices);
router.post("/", protect, authorize("admin"), writeValidators, validate, createService);
router.patch("/:id", protect, authorize("admin"), writeValidators, validate, updateService);
router.delete("/:id", protect, authorize("admin"), deleteService);

module.exports = router;
