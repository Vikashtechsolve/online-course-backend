/**
 * Role hierarchy: superadmin > admin > coordinator/teacher > student
 *
 * Usage:
 *   authorize("superadmin")              — only superadmin
 *   authorize("superadmin", "admin")     — superadmin or admin
 *   authorize("admin", "coordinator")    — admin or coordinator
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    next();
  };
};

module.exports = authorize;
