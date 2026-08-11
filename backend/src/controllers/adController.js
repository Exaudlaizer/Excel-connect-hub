const { Op } = require("sequelize");
const Ad = require("../models/Ad");
const User = require("../models/User");

async function listAds(req, res, next) {
  try {
    const where = {};
    if (req.query.category) where.category = req.query.category;

    // Same rule as jobs: the moderation queue is admin-only, an owner sees
    // their own submissions, and everyone else sees approved ads.
    if (req.user?.role === "admin") {
      if (req.query.status) where.status = req.query.status;
    } else if (req.user) {
      where[Op.and] = [
        { [Op.or]: [{ status: "approved" }, { ownerId: req.user.id }] },
        ...(req.query.status ? [{ status: req.query.status }] : [])
      ];
    } else {
      where.status = "approved";
    }

    const ads = await Ad.findAll({
      where,
      include: [{ model: User, as: "owner", attributes: ["id", "name", "role"] }],
      order: [["createdAt", "DESC"]]
    });
    res.json({ ads });
  } catch (error) {
    next(error);
  }
}

async function createAd(req, res, next) {
  try {
    const ad = await Ad.create({
      ...req.body,
      ownerId: req.user.id,
      status: req.user.role === "admin" ? "approved" : "pending"
    });
    res.status(201).json({ ad });
  } catch (error) {
    next(error);
  }
}

async function updateAdStatus(req, res, next) {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ message: "Advertisement not found" });
    await ad.update({ status: req.body.status });
    res.json({ ad });
  } catch (error) {
    next(error);
  }
}

module.exports = { listAds, createAd, updateAdStatus };
