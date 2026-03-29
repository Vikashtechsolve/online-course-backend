const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/roleAuth");
const {
  getCourses,
  createCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
  assignTeacher,
  unassignTeacher,
  assignCoordinator,
  unassignCoordinator,
  enrollStudent,
  unenrollStudent,
  markCourseComplete,
  bulkMarkCourseComplete,
} = require("../controllers/courseController");

const router = express.Router();

router.get("/", protect, getCourses);
router.post("/", protect, authorize("superadmin", "admin", "coordinator"), createCourse);
router.get("/:id", protect, getCourseById);
router.put("/:id", protect, authorize("superadmin", "admin", "coordinator"), updateCourse);
router.delete("/:id", protect, authorize("superadmin", "admin", "coordinator"), deleteCourse);
router.post("/:id/teachers", protect, authorize("superadmin", "admin", "coordinator"), assignTeacher);
router.delete("/:id/teachers/:teacherId", protect, authorize("superadmin", "admin", "coordinator"), unassignTeacher);
router.post("/:id/coordinators", protect, authorize("superadmin", "admin"), assignCoordinator);
router.delete("/:id/coordinators/:coordinatorId", protect, authorize("superadmin", "admin"), unassignCoordinator);
router.post("/:id/students", protect, authorize("superadmin", "admin", "coordinator"), enrollStudent);
router.post("/:id/students/bulk-complete", protect, bulkMarkCourseComplete);
router.post("/:id/students/:studentId/complete", protect, markCourseComplete);
router.delete("/:id/students/:studentId", protect, authorize("superadmin", "admin", "coordinator"), unenrollStudent);

module.exports = router;
