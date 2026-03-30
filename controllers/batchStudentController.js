const Batch = require("../models/Batch");
const BatchStudent = require("../models/BatchStudent");
const Course = require("../models/Course");
const CourseStudent = require("../models/CourseStudent");
const User = require("../models/User");
const { sendWelcomeEmail } = require("../services/emailService");

function resolveBatchId(batchRef) {
  const isObjectId = /^[a-fA-F0-9]{24}$/.test(batchRef);
  if (isObjectId) return batchRef;
  return Batch.findOne({ slug: batchRef }).then((b) => (b ? b._id : null));
}

async function enrollInBatchCourses(batchId, studentId, enrolledBy) {
  const courses = await Course.find({ batch: batchId, isActive: true });
  for (const course of courses) {
    await CourseStudent.findOneAndUpdate(
      { course: course._id, student: studentId },
      { $setOnInsert: { course: course._id, student: studentId, enrolledBy } },
      { upsert: true }
    );
  }
}

async function unenrollFromBatchCourses(batchId, studentId) {
  const courses = await Course.find({ batch: batchId });
  const courseIds = courses.map((c) => c._id);
  await CourseStudent.deleteMany({ course: { $in: courseIds }, student: studentId });
}

// GET /api/batches/:batchId/students
const getBatchStudents = async (req, res) => {
  try {
    const batchId = await resolveBatchId(req.params.batchId);
    if (!batchId) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const { search } = req.query;
    const filter = { batch: batchId };

    const enrollments = await BatchStudent.find(filter)
      .populate("student", "name email phone isActive createdAt")
      .populate("enrolledBy", "name")
      .sort({ createdAt: -1 })
      .lean();

    let students = enrollments.map((e) => ({
      ...e,
      student: { ...e.student, batchEnrollmentActive: e.isActive },
    }));

    if (search) {
      const q = search.toLowerCase();
      students = students.filter(
        (s) =>
          s.student?.name?.toLowerCase().includes(q) ||
          s.student?.email?.toLowerCase().includes(q)
      );
    }

    res.json({ students });
  } catch (error) {
    console.error("Get batch students error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/batches/:batchId/students — manual enroll (create user + add to batch)
const enrollStudent = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const batchId = await resolveBatchId(req.params.batchId);

    if (!batchId) {
      return res.status(404).json({ message: "Batch not found" });
    }
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    let user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      user = await User.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone?.trim() || "",
        role: "student",
        createdBy: req.user._id,
      });
      sendWelcomeEmail(user.email, user.name, "student", password).catch((err) =>
        console.error("Welcome email failed:", err)
      );
    } else if (user.role !== "student") {
      return res.status(400).json({ message: "User exists with a different role" });
    } else {
      const existing = await BatchStudent.findOne({ batch: batchId, student: user._id });
      if (existing) {
        return res.status(400).json({ message: "Student is already enrolled in this batch" });
      }
    }

    const bs = await BatchStudent.create({
      batch: batchId,
      student: user._id,
      enrolledBy: req.user._id,
      isActive: true,
    });

    await enrollInBatchCourses(batchId, user._id, req.user._id);

    const populated = await BatchStudent.findById(bs._id)
      .populate("student", "name email phone isActive")
      .populate("batch", "name slug");
    res.status(201).json({ enrollment: populated });
  } catch (error) {
    console.error("Enroll student error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Student is already enrolled in this batch" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/batches/:batchId/students/upload — CSV bulk enroll
const enrollFromCsv = async (req, res) => {
  try {
    const batchId = await resolveBatchId(req.params.batchId);
    if (!batchId) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const text = req.file.buffer.toString("utf-8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
        rows.push({ name: parts[0], email: parts[1].toLowerCase(), password: parts[2] });
      }
    }

    if (rows.length === 0) {
      return res.status(400).json({
        message: "No valid rows found. CSV must have: name, email, password (comma-separated)",
      });
    }

    const results = { added: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      if (row.password.length < 6) {
        results.errors.push(`${row.email}: Password too short`);
        results.skipped++;
        continue;
      }

      try {
        let user = await User.findOne({ email: row.email });
        if (!user) {
          user = await User.create({
            name: row.name,
            email: row.email,
            password: row.password,
            role: "student",
            createdBy: req.user._id,
          });
          sendWelcomeEmail(user.email, user.name, "student", row.password).catch(() => {});
        } else if (user.role !== "student") {
          results.errors.push(`${row.email}: User has different role`);
          results.skipped++;
          continue;
        }

        const existing = await BatchStudent.findOne({ batch: batchId, student: user._id });
        if (existing) {
          results.skipped++;
          continue;
        }

        await BatchStudent.create({
          batch: batchId,
          student: user._id,
          enrolledBy: req.user._id,
          isActive: true,
        });
        await enrollInBatchCourses(batchId, user._id, req.user._id);
        results.added++;
      } catch (err) {
        results.errors.push(`${row.email}: ${err.message || "Failed"}`);
        results.skipped++;
      }
    }

    res.json({ message: "Upload complete", ...results });
  } catch (error) {
    console.error("CSV enroll error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/batches/:batchId/students/:studentId — remove from batch
const removeStudent = async (req, res) => {
  try {
    const batchId = await resolveBatchId(req.params.batchId);
    const { studentId } = req.params;

    if (!batchId) return res.status(404).json({ message: "Batch not found" });

    const deleted = await BatchStudent.findOneAndDelete({
      batch: batchId,
      student: studentId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    await unenrollFromBatchCourses(batchId, studentId);
    res.json({ message: "Student removed from batch" });
  } catch (error) {
    console.error("Remove student error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/batches/:batchId/students/:studentId — toggle batch access (isActive) or user isActive
const updateStudentAccess = async (req, res) => {
  try {
    const batchId = await resolveBatchId(req.params.batchId);
    const { studentId } = req.params;
    const { isActive, userIsActive } = req.body;

    if (!batchId) return res.status(404).json({ message: "Batch not found" });

    const enrollment = await BatchStudent.findOne({ batch: batchId, student: studentId });
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    if (isActive !== undefined) {
      enrollment.isActive = isActive;
      await enrollment.save();
      if (isActive) {
        await enrollInBatchCourses(batchId, studentId, enrollment.enrolledBy);
      } else {
        await unenrollFromBatchCourses(batchId, studentId);
      }
    }

    if (userIsActive !== undefined) {
      await User.findByIdAndUpdate(studentId, { isActive: userIsActive });
    }

    const populated = await BatchStudent.findById(enrollment._id)
      .populate("student", "name email isActive")
      .populate("batch", "name slug");
    res.json({ enrollment: populated });
  } catch (error) {
    console.error("Update student access error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getBatchStudents,
  enrollStudent,
  enrollFromCsv,
  removeStudent,
  updateStudentAccess,
};
