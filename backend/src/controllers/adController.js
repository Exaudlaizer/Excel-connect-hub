const { Op } = require("sequelize");
const Ad = require("../models/Ad");
const User = require("../models/User");

// Explicit whitelist. Spreading req.body into create() would let a caller set
// `id`, `ownerId`, `createdAt`, or any other column the model happens to have.
const EDITABLE_AD_FIELDS = [
  "title",
  "businessName",
  "category",
  "description",
  "price",
  "contact",
  "location",
  "imageUrl",
  "logoUrl",
  "linkUrl"
];

function pickAdFields(body) {
  const payload = {};
  EDITABLE_AD_FIELDS.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });
  return payload;
}

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

// An advertiser's own submissions, including anything still pending or rejected.
async function myAds(req, res, next) {
  try {
    const ads = await Ad.findAll({ where: { ownerId: req.user.id }, order: [["createdAt", "DESC"]] });
    res.json({ ads });
  } catch (error) {
    next(error);
  }
}

async function createAd(req, res, next) {
  try {
    const ad = await Ad.create({
      ...pickAdFields(req.body),
      ownerId: req.user.id,
      status: req.user.role === "admin" ? "approved" : "pending"
    });
    res.status(201).json({ ad });
  } catch (error) {
    next(error);
  }
}

// Owners may edit their own listing. Editing sends an approved ad back to the
// queue: otherwise an advertiser could get bland copy approved and then swap in
// something else.
async function updateAd(req, res, next) {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ message: "Advertisement not found" });

    const isAdmin = req.user.role === "admin";
    if (ad.ownerId !== req.user.id && !isAdmin) {
      return res.status(403).json({ message: "You can only edit your own advertisement" });
    }

    const updates = pickAdFields(req.body);
    if (!isAdmin && Object.keys(updates).length > 0) updates.status = "pending";

    await ad.update(updates);
    res.json({ ad });
  } catch (error) {
    next(error);
  }
}

async function deleteAd(req, res, next) {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ message: "Advertisement not found" });

    if (ad.ownerId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only remove your own advertisement" });
    }

    await ad.destroy();
    res.json({ message: "Advertisement removed" });
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

module.exports = { listAds, myAds, createAd, updateAd, deleteAd, updateAdStatus };
