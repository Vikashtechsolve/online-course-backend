const express = require("express");
const protect = require("../middleware/auth");
const { uploadLectureMaterials } = require("../middleware/upload");
const {
  getLectures,
  createLecture,
  getLectureById,
  updateLecture,
  uploadLectureMaterials: uploadHandler,
  deleteLecture,
  getDiscussions,
  createDiscussion,
} = require("../controllers/lectureController");

const router = express.Router();

router.get("/", protect, getLectures);
router.post("/", protect, createLecture);
router.get("/:id", protect, getLectureById);
router.put("/:id", protect, updateLecture);
router.post("/:id/upload", protect, uploadLectureMaterials, uploadHandler);
router.delete("/:id", protect, deleteLecture);
router.get("/:id/discussions", protect, getDiscussions);
router.post("/:id/discussions", protect, createDiscussion);

module.exports = router;
