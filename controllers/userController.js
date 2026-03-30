const User = require("../models/User");
const { generateToken } = require("../utils/generateToken");
const { sendWelcomeEmail } = require("../services/emailService");
const protect = require("../middleware/auth");
const {
  uploadToR2,
  deleteFromR2,
  isR2Configured,
  uploadToLocal,
  isLocalAvatarUrl,
  deleteLocalFile,
} = require("../services/uploadService");

// Which roles can each role create
const CREATION_PERMISSIONS = {
  superadmin: ["admin", "coordinator", "teacher", "student"],
  admin: ["coordinator", "teacher", "student"],
};

// POST /api/users — create/enroll a user (admin+ only)
const createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password, and role are required",
      });
    }

    const allowedRoles = CREATION_PERMISSIONS[req.user.role];
    if (!allowedRoles || !allowedRoles.includes(role)) {
      return res.status(403).json({
        message: `You cannot create users with role '${role}'`,
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "A user with this email already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim() || "",
      role,
      createdBy: req.user._id,
    });

    // Send welcome email with credentials (non-blocking)
    sendWelcomeEmail(user.email, user.name, user.role, password).catch(
      (err) => {
        console.error(`Failed to send welcome email to ${user.email}:`, err);
      }
    );

    res.status(201).json({ user: user.toProfile() });
  } catch (error) {
    console.error("Create user error:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "A user with this email already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/users — list users (with optional role filter)
const getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    // Coordinators may only list teachers/students (for course assignment), not admins or other coordinators
    if (req.user.role === "coordinator") {
      const allowed = ["teacher", "student"];
      if (!role || !allowed.includes(role)) {
        return res.status(403).json({
          message:
            "Coordinators can only list teachers or students (use ?role=teacher or ?role=student).",
        });
      }
    }

    // Non-superadmins can't see superadmin accounts
    if (req.user.role !== "superadmin") {
      filter.role = { $ne: "superadmin" };
    }

    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      users: users.map((u) => u.toProfile()),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Non-superadmins can't view superadmin profiles
    if (user.role === "superadmin" && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ user: user.toProfile() });
  } catch (error) {
    console.error("Get user by id error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/users/:id — update a user (admin+ only)
const updateUser = async (req, res) => {
  try {
    const { name, phone, role, isActive } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (isActive !== undefined) updates.isActive = isActive;

    // Role changes only by superadmin
    if (role !== undefined) {
      if (req.user.role !== "superadmin") {
        return res
          .status(403)
          .json({ message: "Only super admin can change user roles" });
      }
      updates.role = role;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent modifying superadmin accounts unless you're superadmin
    if (user.role === "superadmin" && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Cannot modify super admin" });
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    protect.invalidateUser(req.params.id);

    res.json({ user: updatedUser.toProfile() });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/users/:id — deactivate a user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "superadmin") {
      return res
        .status(403)
        .json({ message: "Cannot delete super admin account" });
    }

    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    protect.invalidateUser(req.params.id);

    res.json({ message: "User deactivated successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/users/upload-avatar — upload avatar for current user
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const baseUrl =
      process.env.API_BASE_URL ||
      `${req.protocol}://${req.get("host")}`;

    // Delete old avatar
    if (req.user.avatar) {
      if (isLocalAvatarUrl(req.user.avatar)) {
        await deleteLocalFile(req.user.avatar).catch(() => {});
      } else if (process.env.R2_PUBLIC_URL && req.user.avatar.startsWith(process.env.R2_PUBLIC_URL)) {
        const oldKey = req.user.avatar.replace(`${process.env.R2_PUBLIC_URL}/`, "");
        deleteFromR2(oldKey).catch(() => {});
      }
    }

    let url;

    if (isR2Configured()) {
      try {
        const result = await uploadToR2(req.file, "avatars");
        url = result.url;
      } catch (r2Error) {
        console.warn("R2 upload failed, using local storage:", r2Error.code || r2Error.message);
        const result = await uploadToLocal(req.file, "avatars", baseUrl);
        url = result.url;
      }
    } else {
      const result = await uploadToLocal(req.file, "avatars", baseUrl);
      url = result.url;
    }

    await User.findByIdAndUpdate(req.user._id, { avatar: url });

    protect.invalidateUser(req.user._id);

    res.json({ avatar: url });
  } catch (error) {
    console.error("Upload avatar error:", error);
    const msg = error.message || "Failed to upload avatar";
    res.status(500).json({ message: msg });
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  uploadAvatar,
};
