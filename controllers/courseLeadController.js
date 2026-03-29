const ExcelJS = require("exceljs");
const CourseIntakeBatch = require("../models/CourseIntakeBatch");
const CourseLeadRegistration = require("../models/CourseLeadRegistration");
const { COURSE_TYPES } = require("../models/CourseIntakeBatch");
const { MARKETING_STATUSES } = require("../models/CourseLeadRegistration");

const STAFF_ROLES = ["superadmin", "admin", "coordinator"];

function courseTypeLabel(type) {
  if (type === "fullstack_developer") return "Full Stack MERN";
  if (type === "data_analytics") return "Data Analytics";
  return type;
}

function programLabel(p) {
  return p === "mini" ? "Mini" : p === "macro" ? "Macro" : p;
}

/** GET /api/course-leads/public/active-batch/:courseType */
exports.getActiveIntakeBatch = async (req, res) => {
  try {
    const { courseType } = req.params;
    if (!COURSE_TYPES.includes(courseType)) {
      return res.status(400).json({ message: "Invalid course type" });
    }

    const batch = await CourseIntakeBatch.findOne({
      courseType,
      isActive: true,
      isAcceptingRegistrations: true,
    }).sort({ batchStartDate: -1, createdAt: -1 });

    if (!batch) {
      return res.status(404).json({
        message: "No open intake batch for this course. Please check back soon.",
      });
    }

    return res.json({
      batch: {
        _id: batch._id,
        displayName: batch.displayName,
        batchStartDate: batch.batchStartDate,
        courseType: batch.courseType,
      },
    });
  } catch (e) {
    console.error("getActiveIntakeBatch", e);
    return res.status(500).json({ message: "Failed to load batch" });
  }
};

/** POST /api/course-leads/register */
exports.registerCourseLead = async (req, res) => {
  try {
    const {
      intakeBatchId,
      program,
      fullName,
      email,
      phone,
      city,
      currentStatus,
      howHeard,
      message,
      consentMarketing,
    } = req.body;

    if (!intakeBatchId || !program || !fullName || !email || !phone) {
      return res.status(400).json({
        message: "intakeBatchId, program, fullName, email, and phone are required",
      });
    }

    const batch = await CourseIntakeBatch.findById(intakeBatchId);
    if (!batch || !batch.isActive || !batch.isAcceptingRegistrations) {
      return res.status(400).json({
        message: "This intake batch is not accepting registrations",
      });
    }

    const programs = ["mini", "macro"];
    if (!programs.includes(program)) {
      return res.status(400).json({ message: "Invalid program" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const lead = await CourseLeadRegistration.create({
      intakeBatch: batch._id,
      courseType: batch.courseType,
      program,
      fullName: String(fullName).trim(),
      email: emailNorm,
      phone: String(phone).trim(),
      city: city != null ? String(city).trim() : "",
      currentStatus: currentStatus != null ? String(currentStatus).trim() : "",
      howHeard: howHeard != null ? String(howHeard).trim() : "",
      message: message != null ? String(message).trim() : "",
      consentMarketing: Boolean(consentMarketing),
    });

    return res.status(201).json({
      message: "Thank you — we have received your details. Our team will contact you soon.",
      id: lead._id,
    });
  } catch (e) {
    console.error("registerCourseLead", e);
    return res.status(500).json({ message: "Registration failed" });
  }
};

/** GET /api/course-leads/admin/intake-batches */
exports.listIntakeBatches = async (req, res) => {
  try {
    const { courseType } = req.query;
    const filter = {};
    if (courseType && COURSE_TYPES.includes(courseType)) {
      filter.courseType = courseType;
    }

    const batches = await CourseIntakeBatch.find(filter)
      .sort({ batchStartDate: -1, createdAt: -1 })
      .lean();

    const counts = await CourseLeadRegistration.aggregate([
      { $group: { _id: "$intakeBatch", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

    const enriched = batches.map((b) => ({
      ...b,
      registrationCount: countMap[String(b._id)] || 0,
    }));

    return res.json({ batches: enriched });
  } catch (e) {
    console.error("listIntakeBatches", e);
    return res.status(500).json({ message: "Failed to list batches" });
  }
};

/** POST /api/course-leads/admin/intake-batches */
exports.createIntakeBatch = async (req, res) => {
  try {
    const { courseType, displayName, batchStartDate, isAcceptingRegistrations, isActive } =
      req.body;

    if (!courseType || !displayName) {
      return res.status(400).json({ message: "courseType and displayName are required" });
    }
    if (!COURSE_TYPES.includes(courseType)) {
      return res.status(400).json({ message: "Invalid courseType" });
    }

    const batch = await CourseIntakeBatch.create({
      courseType,
      displayName: String(displayName).trim(),
      batchStartDate: batchStartDate ? new Date(batchStartDate) : null,
      isAcceptingRegistrations: isAcceptingRegistrations !== false,
      isActive: isActive !== false,
    });

    return res.status(201).json({ batch });
  } catch (e) {
    console.error("createIntakeBatch", e);
    return res.status(500).json({ message: "Failed to create batch" });
  }
};

/** PATCH /api/course-leads/admin/intake-batches/:id */
exports.updateIntakeBatch = async (req, res) => {
  try {
    const batch = await CourseIntakeBatch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const {
      displayName,
      batchStartDate,
      isAcceptingRegistrations,
      isActive,
      courseType,
    } = req.body;

    if (displayName != null) batch.displayName = String(displayName).trim();
    if (batchStartDate !== undefined) {
      batch.batchStartDate = batchStartDate ? new Date(batchStartDate) : null;
    }
    if (isAcceptingRegistrations !== undefined) {
      batch.isAcceptingRegistrations = Boolean(isAcceptingRegistrations);
    }
    if (isActive !== undefined) batch.isActive = Boolean(isActive);
    if (courseType != null && COURSE_TYPES.includes(courseType)) {
      batch.courseType = courseType;
    }

    await batch.save();
    return res.json({ batch });
  } catch (e) {
    console.error("updateIntakeBatch", e);
    return res.status(500).json({ message: "Failed to update batch" });
  }
};

function buildRegistrationFilter(query) {
  const {
    intakeBatchId,
    courseType,
    program,
    marketingStatus,
    search,
    from,
    to,
  } = query;

  const filter = {};

  if (intakeBatchId) filter.intakeBatch = intakeBatchId;
  if (courseType && COURSE_TYPES.includes(courseType)) filter.courseType = courseType;
  if (program && ["mini", "macro"].includes(program)) filter.program = program;
  if (marketingStatus && MARKETING_STATUSES.includes(marketingStatus)) {
    filter.marketingStatus = marketingStatus;
  }

  if (search && String(search).trim()) {
    const q = String(search).trim();
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { fullName: rx },
      { email: rx },
      { phone: rx },
      { city: rx },
    ];
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  return filter;
}

/** GET /api/course-leads/admin/registrations */
exports.listRegistrations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const filter = buildRegistrationFilter(req.query);

    const [items, total] = await Promise.all([
      CourseLeadRegistration.find(filter)
        .populate("intakeBatch", "displayName batchStartDate courseType")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CourseLeadRegistration.countDocuments(filter),
    ]);

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (e) {
    console.error("listRegistrations", e);
    return res.status(500).json({ message: "Failed to list registrations" });
  }
};

/** PATCH /api/course-leads/admin/registrations/:id */
exports.updateRegistration = async (req, res) => {
  try {
    const lead = await CourseLeadRegistration.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: "Registration not found" });
    }

    const { marketingStatus, adminNotes } = req.body;

    if (marketingStatus != null) {
      if (!MARKETING_STATUSES.includes(marketingStatus)) {
        return res.status(400).json({ message: "Invalid marketingStatus" });
      }
      lead.marketingStatus = marketingStatus;
    }
    if (adminNotes !== undefined) {
      lead.adminNotes = String(adminNotes).slice(0, 4000);
    }

    await lead.save();
    const populated = await CourseLeadRegistration.findById(lead._id)
      .populate("intakeBatch", "displayName batchStartDate courseType")
      .lean();

    return res.json({ item: populated });
  } catch (e) {
    console.error("updateRegistration", e);
    return res.status(500).json({ message: "Failed to update" });
  }
};

/** GET /api/course-leads/admin/registrations/export */
exports.exportRegistrations = async (req, res) => {
  try {
    const filter = buildRegistrationFilter(req.query);

    const rows = await CourseLeadRegistration.find(filter)
      .populate("intakeBatch", "displayName batchStartDate courseType")
      .sort({ createdAt: -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Registrations", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "Registered At", key: "createdAt", width: 22 },
      { header: "Batch", key: "batchName", width: 28 },
      { header: "Batch Start", key: "batchStart", width: 14 },
      { header: "Course", key: "course", width: 18 },
      { header: "Program", key: "program", width: 10 },
      { header: "Full Name", key: "fullName", width: 24 },
      { header: "Email", key: "email", width: 32 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "City", key: "city", width: 16 },
      { header: "Current Status", key: "currentStatus", width: 22 },
      { header: "How Heard", key: "howHeard", width: 20 },
      { header: "Message", key: "message", width: 40 },
      { header: "Marketing Consent", key: "consent", width: 14 },
      { header: "Lead Status", key: "marketingStatus", width: 14 },
      { header: "Admin Notes", key: "adminNotes", width: 36 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const r of rows) {
      const b = r.intakeBatch;
      sheet.addRow({
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
        batchName: b?.displayName || "",
        batchStart: b?.batchStartDate ? new Date(b.batchStartDate).toISOString().slice(0, 10) : "",
        course: courseTypeLabel(r.courseType),
        program: programLabel(r.program),
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        city: r.city || "",
        currentStatus: r.currentStatus || "",
        howHeard: r.howHeard || "",
        message: r.message || "",
        consent: r.consentMarketing ? "Yes" : "No",
        marketingStatus: r.marketingStatus,
        adminNotes: r.adminNotes || "",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `course-registrations-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("exportRegistrations", e);
    return res.status(500).json({ message: "Export failed" });
  }
};

exports.STAFF_ROLES = STAFF_ROLES;
