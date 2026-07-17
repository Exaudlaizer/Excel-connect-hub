const { Op } = require("sequelize");
const User = require("../models/User");
const { publicUser } = require("./authController");

async function listUsers(req, res, next) {
  try {
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.status) where.status = req.query.status;

    // Free-text search across name and email for the admin user table.
    const search = (req.query.q || "").trim();
    if (search) {
      where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { email: { [Op.iLike]: `%${search}%` } }];
    }

    const users = await User.findAll({ where, order: [["createdAt", "DESC"]] });
    res.json({ users });
  } catch (error) {
    next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    const allowed = ["name", "studentProfile", "companyProfile", "mentorProfile"];
    const updates = {};

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await req.user.update(updates);

    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    // Suspending yourself is an instant lockout: `protect` rejects any account
    // that is not active, so the token you are holding stops working.
    if (user.id === req.user.id) {
      return res.status(400).json({ message: "You cannot change your own account status" });
    }

    await user.update({ status: req.body.status });
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

module.exports = { listUsers, updateMe, updateUserStatus };
