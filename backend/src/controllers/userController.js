const { Op } = require("sequelize");
const User = require("../models/User");
const { publicUser } = require("./authController");
const { buildMeta, readPagination } = require("../utils/pagination");

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

    const { page, limit, offset } = readPagination(req.query);
    const { rows, count } = await User.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset
    });
    res.json({ users: rows, pagination: buildMeta({ page, limit, total: count }) });
  } catch (error) {
    next(error);
  }
}

// Fields a user may change about themselves. `role`, `status`, `email`, and
// `password` are absent by design — none of them may be changed by writing to
// this endpoint.
const SELF_EDITABLE_FIELDS = ["name", "phone", "studentProfile", "companyProfile", "mentorProfile"];

// Preference keys the server recognises. Anything else in the object is dropped,
// so this endpoint cannot be used as free-form per-user storage.
const ALLOWED_PREFERENCES = { theme: ["midnight", "light", "ocean", "forest"] };

function mergePreferences(current, incoming) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return current;

  const next = { ...(current || {}) };
  Object.entries(ALLOWED_PREFERENCES).forEach(([key, values]) => {
    if (incoming[key] !== undefined && values.includes(incoming[key])) next[key] = incoming[key];
  });
  return next;
}

async function updateMe(req, res, next) {
  try {
    const updates = {};

    SELF_EDITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.body.preferences !== undefined) {
      updates.preferences = mergePreferences(req.user.preferences, req.body.preferences);
    }

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

// Promoting and demoting accounts is an admin action. Changing your own role is
// blocked for the same reason as suspending yourself: an admin who demotes
// themselves loses the only way back in.
async function updateUserRole(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.id === req.user.id) {
      return res.status(400).json({ message: "You cannot change your own role" });
    }

    await user.update({ role: req.body.role });
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

module.exports = { listUsers, updateMe, updateUserStatus, updateUserRole };
