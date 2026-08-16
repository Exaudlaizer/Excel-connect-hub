const express = require("express");
const { body } = require("express-validator");
const { login, me, register, SELF_SERVICE_ROLES } = require("../controllers/authController");
const { forgotPassword, resetPassword } = require("../controllers/passwordResetController");
const { resendVerification, verifyEmail } = require("../controllers/emailVerificationController");
const { protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.post(
  "/register",
  [
    body("name").trim().isLength({ min: 2 }).withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("role").optional().isIn(SELF_SERVICE_ROLES).withMessage("Invalid role")
  ],
  validate,
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required")
  ],
  validate,
  login
);

router.post(
  "/forgot-password",
  [body("email").isEmail().normalizeEmail().withMessage("Valid email is required")],
  validate,
  forgotPassword
);

router.post(
  "/reset-password",
  [
    body("token").trim().notEmpty().withMessage("Reset token is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
  ],
  validate,
  resetPassword
);

router.post("/verify-email", [body("token").trim().notEmpty().withMessage("Verification token is required")], validate, verifyEmail);
router.post("/resend-verification", [body("email").isEmail().normalizeEmail().withMessage("Valid email is required")], validate, resendVerification);

router.get("/me", protect, me);

module.exports = router;
