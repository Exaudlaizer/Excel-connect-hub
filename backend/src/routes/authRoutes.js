const express = require("express");
const { body } = require("express-validator");
const { login, me, register, SELF_SERVICE_ROLES } = require("../controllers/authController");
const { forgotPassword, resetPassword } = require("../controllers/passwordResetController");
const {
  confirmCode,
  confirmCodePublic,
  requestCode,
  requestCodePublic
} = require("../controllers/otpController");
const { protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.post(
  "/register",
  [
    body("name").trim().isLength({ min: 2 }).withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("phone")
      .optional({ values: "falsy" })
      .trim()
      .matches(/^\+?[0-9\s-]{7,20}$/)
      .withMessage("Enter a valid phone number"),
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

/* ---------------------------------------------------------------------------
   Verification codes
   ---------------------------------------------------------------------------
   Two pairs of endpoints for the same flow. The authenticated pair is used from
   inside the app (and is the only way to confirm a phone number, since that
   requires knowing whose phone it is). The public pair exists for someone who
   registered, closed the tab, and came back without signing in.
   ------------------------------------------------------------------------- */

const codeValidator = body("code")
  .trim()
  .matches(/^[0-9]{6}$/)
  .withMessage("Enter the 6-digit code from your email");

const purposeValidator = body("purpose").optional().isIn(["email", "phone"]).withMessage("Invalid verification type");

router.post("/verification/request", protect, [purposeValidator], validate, requestCode);
router.post("/verification/confirm", protect, [purposeValidator, codeValidator], validate, confirmCode);

router.post(
  "/verification/request-public",
  [body("email").isEmail().normalizeEmail().withMessage("Valid email is required")],
  validate,
  requestCodePublic
);
router.post(
  "/verification/confirm-public",
  [body("email").isEmail().normalizeEmail().withMessage("Valid email is required"), codeValidator],
  validate,
  confirmCodePublic
);

router.get("/me", protect, me);

module.exports = router;
