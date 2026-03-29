const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/roleAuth");
const {
  getActiveIntakeBatch,
  registerCourseLead,
  listIntakeBatches,
  createIntakeBatch,
  updateIntakeBatch,
  listRegistrations,
  updateRegistration,
  exportRegistrations,
} = require("../controllers/courseLeadController");

const router = express.Router();

const staff = ["superadmin", "admin", "coordinator"];

router.get("/public/active-batch/:courseType", getActiveIntakeBatch);
router.post("/register", registerCourseLead);

router.get("/admin/intake-batches", protect, authorize(...staff), listIntakeBatches);
router.post("/admin/intake-batches", protect, authorize(...staff), createIntakeBatch);
router.patch("/admin/intake-batches/:id", protect, authorize(...staff), updateIntakeBatch);

router.get("/admin/registrations", protect, authorize(...staff), listRegistrations);
router.patch("/admin/registrations/:id", protect, authorize(...staff), updateRegistration);
router.get("/admin/registrations/export", protect, authorize(...staff), exportRegistrations);

module.exports = router;
