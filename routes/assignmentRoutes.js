const express = require("express");
const protect = require("../middleware/auth");
const { uploadFile } = require("../middleware/upload");
const {
  getAssignments,
  createAssignment,
  getAssignmentById,
  updateAssignment,
  submitAssignment,
  getSubmissions,
  updateSubmission,
} = require("../controllers/assignmentController");

const router = express.Router();

router.get("/", protect, getAssignments);
router.post("/", protect, uploadFile, createAssignment);
router.get("/:id", protect, getAssignmentById);
router.put("/:id", protect, uploadFile, updateAssignment);
router.post("/:id/submit", protect, submitAssignment);
router.get("/:id/submissions", protect, getSubmissions);

module.exports = router;
