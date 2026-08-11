const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || user.status !== "active") {
      return res.status(401).json({ message: "Invalid authenticated user" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Same as `protect`, but an absent or unusable token is not an error — the
// request simply continues as an anonymous visitor. A suspended account is
// treated as anonymous too, so suspension immediately removes the wider
// visibility that staff and owner roles get on listing endpoints.
async function optionalProtect(req, _res, next) {
  req.user = null;

  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (user && user.status === "active") req.user = user;
    }
  } catch (error) {
    req.user = null;
  }

  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this resource" });
    }

    next();
  };
}

module.exports = { protect, optionalProtect, authorize };
