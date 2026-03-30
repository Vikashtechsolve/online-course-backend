const { verifyToken } = require("../utils/generateToken");
const User = require("../models/User");
const { LRUCache } = require("lru-cache");

const userCache = new LRUCache({
  max: 500,
  ttl: 60_000, // 1 minute
});

const USER_SELECT = "_id name email phone role avatar isActive createdAt updatedAt";

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = verifyToken(token);
    const userId = decoded.id;

    let user = userCache.get(userId);
    if (!user) {
      user = await User.findById(userId).select(USER_SELECT).lean();
      if (user) userCache.set(userId, user);
    }

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.isActive) {
      userCache.delete(userId);
      return res.status(403).json({ message: "Account is deactivated" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

/** Clear a user from the auth cache (call after profile updates, deactivation, etc.) */
protect.invalidateUser = (userId) => {
  if (userId) userCache.delete(String(userId));
};

module.exports = protect;
