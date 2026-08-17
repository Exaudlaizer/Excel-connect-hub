const express = require("express");
const { body } = require("express-validator");
const {
  createPost,
  createReply,
  deletePost,
  deleteReply,
  getPost,
  listPosts,
  pinPost
} = require("../controllers/communityController");
const { authorize, optionalProtect, protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

const CATEGORIES = ["discussion", "question", "announcement", "group", "event"];

router.get("/", optionalProtect, listPosts);
router.get("/:id", optionalProtect, getPost);

router.post(
  "/",
  protect,
  [
    body("title").trim().isLength({ min: 4, max: 180 }).withMessage("Give your post a title of at least 4 characters"),
    body("body").trim().isLength({ min: 10 }).withMessage("Write at least 10 characters"),
    body("category").optional().isIn(CATEGORIES).withMessage("Invalid category")
  ],
  validate,
  createPost
);

router.post(
  "/:id/replies",
  protect,
  [body("body").trim().isLength({ min: 2 }).withMessage("Write a reply first")],
  validate,
  createReply
);

router.patch(
  "/:id/pin",
  protect,
  authorize("admin"),
  [body("pinned").isBoolean().withMessage("pinned must be true or false")],
  validate,
  pinPost
);

router.delete("/:id", protect, deletePost);
router.delete("/:id/replies/:replyId", protect, deleteReply);

module.exports = router;
