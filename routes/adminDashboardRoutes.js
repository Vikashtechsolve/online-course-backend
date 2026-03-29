const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/roleAuth");
const { getAdminDashboard } = require("../controllers/adminDashboardController");

const router = express.Router();

router.get(
  "/",
  protect,
  authorize("superadmin", "admin", "coordinator", "teacher"),
  getAdminDashboard
);

module.exports = router;
