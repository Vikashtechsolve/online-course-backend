const SupportTicket = require("../models/SupportTicket");
const { uploadFileAndGetUrl } = require("../services/uploadService");

const STAFF_ROLES = ["superadmin", "admin", "coordinator", "teacher"];

async function generateTicketNumber() {
  const year = new Date().getFullYear();
  for (let i = 0; i < 8; i++) {
    const n = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `TCK-${year}-${n}`;
    const exists = await SupportTicket.exists({ ticketNumber });
    if (!exists) return ticketNumber;
  }
  return `TCK-${year}-${Date.now()}`;
}

function isStaff(user) {
  return user && STAFF_ROLES.includes(user.role);
}

// POST /api/tickets — student creates ticket (multipart: fields + optional file)
const createTicket = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can create tickets" });
    }
    const { title, description, course, category } = req.body;
    const attachmentName = req.file?.originalname?.trim() || req.body.attachmentName?.trim() || "";
    if (!title?.trim() || !description?.trim() || !course?.trim() || !category?.trim()) {
      return res.status(400).json({ message: "Title, description, course, and category are required" });
    }

    let attachmentUrl = "";
    if (req.file) {
      attachmentUrl = await uploadFileAndGetUrl(req.file, "support-tickets") || "";
      if (!attachmentUrl) {
        return res.status(500).json({ message: "Failed to upload attachment. Try again." });
      }
    }

    const ticketNumber = await generateTicketNumber();
    const ticket = await SupportTicket.create({
      ticketNumber,
      student: req.user._id,
      title: title.trim(),
      description: description.trim(),
      course: course.trim(),
      category: category.trim(),
      attachmentName,
      attachmentUrl,
      status: "open",
      messages: [
        {
          authorRole: "student",
          author: req.user._id,
          text: description.trim(),
          attachmentName,
          attachmentUrl,
        },
      ],
    });

    const populated = await SupportTicket.findById(ticket._id)
      .populate("student", "name email")
      .populate("messages.author", "name email role");

    res.status(201).json({ ticket: populated });
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/tickets — student: own; staff: all
const listTickets = async (req, res) => {
  try {
    const { status, course } = req.query;
    const filter = {};

    if (req.user.role === "student") {
      filter.student = req.user._id;
    } else if (!isStaff(req.user)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (status === "open" || status === "resolved") {
      filter.status = status;
    }
    if (course && course !== "All") {
      filter.course = course;
    }

    const tickets = await SupportTicket.find(filter)
      .populate("student", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ tickets });
  } catch (error) {
    console.error("List tickets error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/tickets/open-count — staff: count of open tickets (navbar); students get 0
const getOpenTicketsCount = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return res.json({ count: 0 });
    }
    const count = await SupportTicket.countDocuments({ status: "open" });
    res.json({ count });
  } catch (error) {
    console.error("Open tickets count error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/tickets/:id
const getTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate("student", "name email")
      .populate("messages.author", "name email role");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const studentId = ticket.student?._id ?? ticket.student;
    if (req.user.role === "student" && studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (!isStaff(req.user) && req.user.role !== "student") {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/tickets/:id/student-reply — follow-up while open
const addStudentReply = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can use this endpoint" });
    }
    const { text, attachmentName = "" } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    if (ticket.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (ticket.status !== "open") {
      return res.status(400).json({ message: "Ticket is resolved. Reopen it to send a message." });
    }

    ticket.messages.push({
      authorRole: "student",
      author: req.user._id,
      text: text.trim(),
      attachmentName: attachmentName?.trim() || "",
    });
    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate("student", "name email")
      .populate("messages.author", "name email role");

    res.json({ ticket: populated });
  } catch (error) {
    console.error("Student reply error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/tickets/:id/staff-reply — staff reply; ticket becomes resolved
const addStaffReply = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    ticket.messages.push({
      authorRole: "staff",
      author: req.user._id,
      text: text.trim(),
      attachmentName: "",
      attachmentUrl: "",
    });
    ticket.status = "resolved";
    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate("student", "name email")
      .populate("messages.author", "name email role");

    res.json({ ticket: populated });
  } catch (error) {
    console.error("Staff reply error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/tickets/:id/reopen — student reopens resolved ticket
const reopenTicket = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can reopen tickets" });
    }
    const { text = "" } = req.body;

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    if (ticket.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (ticket.status !== "resolved") {
      return res.status(400).json({ message: "Ticket is already open" });
    }

    ticket.status = "open";
    if (text?.trim()) {
      ticket.messages.push({
        authorRole: "student",
        author: req.user._id,
        text: text.trim(),
        attachmentName: "",
      });
    }
    await ticket.save();

    const populated = await SupportTicket.findById(ticket._id)
      .populate("student", "name email")
      .populate("messages.author", "name email role");

    res.json({ ticket: populated });
  } catch (error) {
    console.error("Reopen ticket error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createTicket,
  listTickets,
  getOpenTicketsCount,
  getTicket,
  addStudentReply,
  addStaffReply,
  reopenTicket,
};
