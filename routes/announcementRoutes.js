const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/roleAuth");
const {
  listAnnouncements,
  getUnreadAnnouncementsCount,
  markAnnouncementsRead,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcementController");

const router = express.Router();

router.get("/", protect, listAnnouncements);
router.get("/unread-count", protect, getUnreadAnnouncementsCount);
router.post("/mark-read", protect, markAnnouncementsRead);
router.post("/", protect, authorize("superadmin", "admin", "coordinator", "teacher"), createAnnouncement);
router.put("/:id", protect, authorize("superadmin", "admin", "coordinator", "teacher"), updateAnnouncement);
router.delete("/:id", protect, authorize("superadmin", "admin", "coordinator", "teacher"), deleteAnnouncement);

module.exports = router;
