const { literal } = require("sequelize");
const CommunityPost = require("../models/CommunityPost");
const CommunityReply = require("../models/CommunityReply");
const User = require("../models/User");

const AUTHOR_ATTRIBUTES = ["id", "name", "role"];

// Announcements carry platform-wide weight, so only staff may file one. Everyone
// else posts discussions, questions, groups, and events.
const STAFF_ONLY_CATEGORIES = ["announcement"];

function canModerate(user, post) {
  return user.role === "admin" || post.authorId === user.id;
}

async function listPosts(req, res, next) {
  try {
    const where = {};
    if (req.query.category) where.category = req.query.category;

    const posts = await CommunityPost.findAll({
      where,
      include: [{ model: User, as: "author", attributes: AUTHOR_ATTRIBUTES }],
      attributes: {
        // Counted in SQL rather than by loading every reply row: the feed only
        // needs the number, and a busy thread would otherwise be shipped whole.
        include: [
          [
            literal(
              `(SELECT COUNT(*)::int FROM community_replies AS r WHERE r."postId" = "CommunityPost"."id")`
            ),
            "replyCount"
          ]
        ]
      },
      order: [
        ["pinned", "DESC"],
        ["createdAt", "DESC"]
      ],
      limit: Math.min(Number(req.query.limit) || 50, 100)
    });

    res.json({ posts });
  } catch (error) {
    next(error);
  }
}

async function getPost(req, res, next) {
  try {
    const post = await CommunityPost.findByPk(req.params.id, {
      include: [
        { model: User, as: "author", attributes: AUTHOR_ATTRIBUTES },
        {
          model: CommunityReply,
          as: "replies",
          include: [{ model: User, as: "author", attributes: AUTHOR_ATTRIBUTES }]
        }
      ],
      order: [[{ model: CommunityReply, as: "replies" }, "createdAt", "ASC"]]
    });

    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json({ post });
  } catch (error) {
    next(error);
  }
}

async function createPost(req, res, next) {
  try {
    const category = req.body.category || "discussion";

    if (STAFF_ONLY_CATEGORIES.includes(category) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only an administrator can post an announcement" });
    }

    const created = await CommunityPost.create({
      authorId: req.user.id,
      title: req.body.title,
      body: req.body.body,
      category,
      // Pinning is a moderation action, never something the request body decides.
      pinned: req.user.role === "admin" ? Boolean(req.body.pinned) : false
    });

    const post = await CommunityPost.findByPk(created.id, {
      include: [{ model: User, as: "author", attributes: AUTHOR_ATTRIBUTES }]
    });

    res.status(201).json({ post });
  } catch (error) {
    next(error);
  }
}

async function deletePost(req, res, next) {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (!canModerate(req.user, post)) {
      return res.status(403).json({ message: "You can only remove your own post" });
    }

    await post.destroy();
    res.json({ message: "Post removed" });
  } catch (error) {
    next(error);
  }
}

async function pinPost(req, res, next) {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    await post.update({ pinned: Boolean(req.body.pinned) });
    res.json({ post });
  } catch (error) {
    next(error);
  }
}

async function createReply(req, res, next) {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const created = await CommunityReply.create({
      postId: post.id,
      authorId: req.user.id,
      body: req.body.body
    });

    const reply = await CommunityReply.findByPk(created.id, {
      include: [{ model: User, as: "author", attributes: AUTHOR_ATTRIBUTES }]
    });

    res.status(201).json({ reply });
  } catch (error) {
    next(error);
  }
}

async function deleteReply(req, res, next) {
  try {
    const reply = await CommunityReply.findByPk(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });
    if (req.user.role !== "admin" && reply.authorId !== req.user.id) {
      return res.status(403).json({ message: "You can only remove your own reply" });
    }

    await reply.destroy();
    res.json({ message: "Reply removed" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listPosts, getPost, createPost, deletePost, pinPost, createReply, deleteReply };
