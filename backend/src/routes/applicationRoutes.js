const express = require("express");
const { body } = require("express-validator");
const {
  applicantsForCompany,
  createApplication,
  myApplications,
  updateApplicationStatus
} = require("../controllers/applicationController");
const { authorize, protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("student"),
  [
    body("job").isUUID().withMessage("Valid job id is required"),
    body("coverLetter").trim().isLength({ min: 20 }).withMessage("Cover letter must be at least 20 characters"),
    body("cvUrl").optional().isURL().withMessage("CV URL must be valid")
  ],
  validate,
  createApplication
);

router.get("/mine", protect, authorize("student"), myApplications);
router.get("/applicants", protect, authorize("company", "admin"), applicantsForCompany);
router.patch(
  "/:id/status",
  protect,
  authorize("company", "admin"),
  [body("status").isIn(["submitted", "reviewing", "shortlisted", "rejected", "hired"]).withMessage("Invalid status")],
  validate,
  updateApplicationStatus
);

module.exports = router;
