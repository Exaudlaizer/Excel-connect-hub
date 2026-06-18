const User = require("../models/User");
const { publicUser } = require("./authController");

async function listUsers(req, res, next) {
  try {
    const users = await User.findAll({ order: [["createdAt", "DESC"]] });
    res.json({ users });
  } catch (error) {
    next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    const allowed = ["name", "studentProfile", "companyProfile"];
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
    await user.update({ status: req.body.status });
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

module.exports = { listUsers, updateMe, updateUserStatus };
