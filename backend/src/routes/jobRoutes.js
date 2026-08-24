const express = require("express");
const { body } = require("express-validator");
const { approveJob, createJob, deleteJob, listJobs, myJobs, updateJob } = require("../controllers/jobController");
const { authorize, optionalProtect, protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

const jobValidation = [
  body("title").trim().isLength({ min: 3 }).withMessage("Title is required"),
  body("type").isIn(["job", "internship"]).withMessage("Invalid opportunity type"),
  body("location").trim().notEmpty().withMessage("Location is required"),
  body("workMode").optional().isIn(["onsite", "remote", "hybrid"]).withMessage("Invalid work mode"),
  body("description").trim().isLength({ min: 20 }).withMessage("Description must be at least 20 characters")
];

router.get("/", optionalProtect, listJobs);
router.get("/mine", protect, authorize("company", "admin"), myJobs);
router.post("/", protect, authorize("company", "admin"), jobValidation, validate, createJob);
router.patch("/:id", protect, authorize("company", "admin"), updateJob);
router.delete("/:id", protect, authorize("company", "admin"), deleteJob);
router.patch(
  "/:id/approval",
  protect,
  authorize("admin"),
  [body("status").isIn(["approved", "rejected", "closed"]).withMessage("Invalid status")],
  validate,
  approveJob
);

module.exports = router;
