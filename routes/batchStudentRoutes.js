const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/roleAuth");
const { uploadCsv } = require("../middleware/upload");
const {
  getBatchStudents,
  enrollStudent,
  enrollFromCsv,
  removeStudent,
  updateStudentAccess,
} = require("../controllers/batchStudentController");

const router = express.Router({ mergeParams: true });

router.get("/", protect, authorize("superadmin", "admin", "coordinator"), getBatchStudents);
router.post("/", protect, authorize("superadmin", "admin", "coordinator"), enrollStudent);
router.post("/upload", protect, authorize("superadmin", "admin", "coordinator"), uploadCsv, enrollFromCsv);
router.delete("/:studentId", protect, authorize("superadmin", "admin", "coordinator"), removeStudent);
router.put("/:studentId", protect, authorize("superadmin", "admin", "coordinator"), updateStudentAccess);

module.exports = router;
