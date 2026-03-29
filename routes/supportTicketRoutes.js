const express = require("express");
const protect = require("../middleware/auth");
const authorize = require("../middleware/roleAuth");
const { uploadFile } = require("../middleware/upload");
const {
  createTicket,
  listTickets,
  getOpenTicketsCount,
  getTicket,
  addStudentReply,
  addStaffReply,
  reopenTicket,
} = require("../controllers/supportTicketController");

const router = express.Router();

router.use(protect);

router.post("/", authorize("student"), uploadFile, createTicket);
router.get("/", listTickets);
router.get("/open-count", getOpenTicketsCount);
router.get("/:id", getTicket);
router.post("/:id/student-reply", authorize("student"), addStudentReply);
router.post("/:id/staff-reply", authorize("superadmin", "admin", "coordinator", "teacher"), addStaffReply);
router.post("/:id/reopen", authorize("student"), reopenTicket);

module.exports = router;
