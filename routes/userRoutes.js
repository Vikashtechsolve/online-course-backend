const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const authorize = require("../middleware/roleAuth");
const { uploadAvatar } = require("../middleware/upload");
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  uploadAvatar: uploadAvatarHandler,
} = require("../controllers/userController");

// All routes require authentication
router.use(protect);

router.post("/upload-avatar", (req, res, next) => {
  uploadAvatar(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, uploadAvatarHandler);

router.post("/", authorize("superadmin", "admin"), createUser);
router.get("/", authorize("superadmin", "admin", "coordinator"), getUsers);
router.get("/:id", authorize("superadmin", "admin"), getUserById);
router.put("/:id", authorize("superadmin", "admin"), updateUser);
router.delete("/:id", authorize("superadmin"), deleteUser);

module.exports = router;
