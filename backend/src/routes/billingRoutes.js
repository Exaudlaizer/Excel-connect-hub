const express = require("express");
const { body } = require("express-validator");
const {
  cancel,
  confirmReturn,
  listPlans,
  myPayments,
  mySubscription,
  startCheckout,
  webhook
} = require("../controllers/billingController");
const { protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.get("/plans", protect, listPlans);
router.get("/subscription", protect, mySubscription);
router.get("/payments", protect, myPayments);

router.post(
  "/checkout",
  protect,
  [body("planKey").trim().notEmpty().withMessage("Choose a plan")],
  validate,
  startCheckout
);

router.post(
  "/confirm",
  protect,
  [body("txRef").trim().notEmpty().withMessage("Missing payment reference")],
  validate,
  confirmReturn
);

router.post("/cancel", protect, cancel);

// The webhook is unauthenticated by design — it is called by Flutterwave, not a
// user — and protects itself with a signature check inside the handler.
router.post("/webhook", webhook);

module.exports = router;
