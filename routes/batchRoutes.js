const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/roleAuth");
const {
  getBatches,
  createBatch,
  getBatchById,
  updateBatch,
  deleteBatch,
} = require("../controllers/batchController");

const router = express.Router();

router.get("/", protect, getBatches);
router.post("/", protect, authorize("superadmin", "admin", "coordinator"), createBatch);
router.get("/:id", protect, getBatchById);
router.put("/:id", protect, authorize("superadmin", "admin", "coordinator"), updateBatch);
router.delete("/:id", protect, authorize("superadmin", "admin"), deleteBatch);

module.exports = router;
