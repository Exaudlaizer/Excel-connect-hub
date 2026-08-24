const express = require("express");
const { body } = require("express-validator");
const {
  createCourse,
  deleteCourse,
  enrollCourse,
  listCourses,
  updateCourse,
  updateCourseStatus
} = require("../controllers/courseController");
const { authorize, optionalProtect, protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.get("/", optionalProtect, listCourses);
// Courses belong to mentors. The platform hosts them; it does not author them.
router.post(
  "/",
  protect,
  authorize("mentor", "admin"),
  [
    body("title").trim().isLength({ min: 3 }).withMessage("Title is required"),
    body("category").trim().notEmpty().withMessage("Category is required"),
    body("description").trim().isLength({ min: 20 }).withMessage("Description must be at least 20 characters")
  ],
  validate,
  createCourse
);
router.post("/:id/enroll", protect, authorize("student"), enrollCourse);
router.patch("/:id", protect, authorize("mentor", "admin"), updateCourse);
router.delete("/:id", protect, authorize("mentor", "admin"), deleteCourse);
router.patch(
  "/:id/approval",
  protect,
  authorize("admin"),
  [body("status").isIn(["approved", "rejected", "archived"]).withMessage("Invalid status")],
  validate,
  updateCourseStatus
);

module.exports = router;
