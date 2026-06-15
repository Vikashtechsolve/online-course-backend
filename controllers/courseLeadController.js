const ExcelJS = require("exceljs");
const CourseIntakeBatch = require("../models/CourseIntakeBatch");
const CourseLeadRegistration = require("../models/CourseLeadRegistration");
const { COURSE_TYPES } = require("../models/CourseIntakeBatch");
const {
  MARKETING_STATUSES,
  PAYMENT_PLANS,
} = require("../models/CourseLeadRegistration");
const {
  REGISTRATION_FEE,
  COURSE_FEE,
  getAmountForPlan,
  getBalanceDue,
  fullPaymentAmount,
} = require("../constants/genAiFees");
const {
  completePaidRegistrationFlow,
  formatRegistrationResponse,
  paymentPlanLabel,
} = require("../services/courseRegistrationComplete");

function courseTypeLabel(type) {
  if (type === "fullstack_developer") return "Full Stack MERN";
  if (type === "data_analytics") return "Data Analytics";
  if (type === "generative_ai") return "Generative AI";
  return type;
}

function programLabel(p) {
  if (p === "mini") return "Mini";
  if (p === "macro") return "Macro";
  if (p === "standard") return "Standard";
  return p;
}

function allowedProgramsForCourse(courseType) {
  if (courseType === "generative_ai") return ["standard", "mini", "macro"];
  return ["mini", "macro"];
}

function validateProgram(program, courseType) {
  return allowedProgramsForCourse(courseType).includes(program);
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
    }).sort({ batchStartDate: -1, createdAt: -1 }).lean();

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

    if (!validateProgram(program, batch.courseType)) {
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

/** POST /api/course-leads/register/init — Gen AI paid enrollment (pending until payment completes) */
exports.initPaidRegistration = async (req, res) => {
  try {
    const {
      intakeBatchId,
      program,
      paymentPlan,
      fullName,
      email,
      phone,
      city,
      currentStatus,
      howHeard,
      message,
      consentMarketing,
    } = req.body;

    if (
      !intakeBatchId ||
      !program ||
      !paymentPlan ||
      !fullName ||
      !email ||
      !phone
    ) {
      return res.status(400).json({
        message:
          "intakeBatchId, program, paymentPlan, fullName, email, and phone are required",
      });
    }

    if (!PAYMENT_PLANS.includes(paymentPlan)) {
      return res.status(400).json({ message: "Invalid payment plan" });
    }

    const batch = await CourseIntakeBatch.findById(intakeBatchId);
    if (!batch || !batch.isActive || !batch.isAcceptingRegistrations) {
      return res.status(400).json({
        message: "This intake batch is not accepting registrations",
      });
    }

    if (batch.courseType !== "generative_ai") {
      return res.status(400).json({
        message: "Paid registration is only available for Generative AI",
      });
    }

    if (!validateProgram(program, batch.courseType)) {
      return res.status(400).json({ message: "Invalid program" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (!Boolean(consentMarketing)) {
      return res.status(400).json({ message: "Marketing consent is required" });
    }

    const amountToPay = getAmountForPlan(paymentPlan);
    const balanceDue = getBalanceDue(paymentPlan);
    const discountPercent = 0;

    const existingPending = await CourseLeadRegistration.findOne({
      intakeBatch: batch._id,
      email: emailNorm,
      paymentStatus: "pending",
    });

    if (existingPending) {
      existingPending.fullName = String(fullName).trim();
      existingPending.phone = String(phone).trim();
      existingPending.city = city != null ? String(city).trim() : "";
      existingPending.currentStatus =
        currentStatus != null ? String(currentStatus).trim() : "";
      existingPending.howHeard = howHeard != null ? String(howHeard).trim() : "";
      existingPending.message = message != null ? String(message).trim() : "";
      existingPending.paymentPlan = paymentPlan;
      existingPending.registrationFee = REGISTRATION_FEE;
      existingPending.courseFee = COURSE_FEE;
      existingPending.discountPercent = discountPercent;
      existingPending.amountPaid = 0;
      existingPending.balanceDue = balanceDue;
      existingPending.consentMarketing = true;
      await existingPending.save();

      return res.status(200).json({
        registrationId: existingPending._id,
        amount: amountToPay,
        currency: "INR",
        paymentPlan,
        courseType: batch.courseType,
        batchName: batch.displayName,
      });
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
      consentMarketing: true,
      marketingStatus: "new",
      paymentPlan,
      paymentStatus: "pending",
      registrationFee: REGISTRATION_FEE,
      courseFee: COURSE_FEE,
      discountPercent,
      amountPaid: 0,
      balanceDue,
      currency: "INR",
    });

    return res.status(201).json({
      registrationId: lead._id,
      amount: amountToPay,
      currency: "INR",
      paymentPlan,
      courseType: batch.courseType,
      batchName: batch.displayName,
    });
  } catch (e) {
    console.error("initPaidRegistration", e);
    return res.status(500).json({ message: "Could not start registration" });
  }
};

/** POST /api/course-leads/register/complete — confirm Razorpay payment */
exports.completePaidRegistration = async (req, res) => {
  try {
    const result = await completePaidRegistrationFlow(req.body);
    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error("completePaidRegistration", e);
    return res.status(500).json({
      message:
        "Could not confirm payment. If you were charged, contact support@vikastechsolutions.com with your payment ID.",
      supportEmail: "support@vikastechsolutions.com",
    });
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
    paymentStatus,
    paymentPlan,
    search,
    from,
    to,
  } = query;

  const filter = {};

  if (intakeBatchId) filter.intakeBatch = intakeBatchId;
  if (courseType && COURSE_TYPES.includes(courseType)) filter.courseType = courseType;
  if (program && ["mini", "macro", "standard"].includes(program)) {
    filter.program = program;
  }
  if (marketingStatus && MARKETING_STATUSES.includes(marketingStatus)) {
    filter.marketingStatus = marketingStatus;
  }
  if (
    paymentStatus &&
    ["pending", "completed", "failed", "refunded"].includes(paymentStatus)
  ) {
    filter.paymentStatus = paymentStatus;
  }
  if (paymentPlan && PAYMENT_PLANS.includes(paymentPlan)) {
    filter.paymentPlan = paymentPlan;
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
      { header: "Payment Plan", key: "paymentPlan", width: 18 },
      { header: "Payment Status", key: "paymentStatus", width: 14 },
      { header: "Amount Paid", key: "amountPaid", width: 12 },
      { header: "Balance Due", key: "balanceDue", width: 12 },
      { header: "Razorpay Order", key: "razorpayOrderId", width: 22 },
      { header: "Razorpay Payment", key: "razorpayPaymentId", width: 22 },
      { header: "Paid At", key: "paidAt", width: 22 },
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
        paymentPlan: paymentPlanLabel(r.paymentPlan) || "",
        paymentStatus: r.paymentStatus || "",
        amountPaid: r.amountPaid ?? "",
        balanceDue: r.balanceDue ?? "",
        razorpayOrderId: r.razorpayOrderId || "",
        razorpayPaymentId: r.razorpayPaymentId || "",
        paidAt: r.paidAt ? new Date(r.paidAt).toISOString() : "",
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

