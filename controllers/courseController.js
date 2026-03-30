const Course = require("../models/Course");
const Batch = require("../models/Batch");
const BatchStudent = require("../models/BatchStudent");
const CourseTeacher = require("../models/CourseTeacher");
const CourseCoordinator = require("../models/CourseCoordinator");
const CourseStudent = require("../models/CourseStudent");
const Lecture = require("../models/Lecture");
const Assignment = require("../models/Assignment");
const User = require("../models/User");
const Certificate = require("../models/Certificate");
const { createAndStoreCertificate } = require("../services/certificateService");

// GET /api/courses — list courses (filter by batch)
const getCourses = async (req, res) => {
  try {
    const { batch, batchId, search, teacher, student, coordinator } = req.query;
    const filter = { isActive: true };

    const batchRef = batch || batchId;
    if (batchRef) {
      const isObjectId = /^[a-fA-F0-9]{24}$/.test(batchRef);
      if (isObjectId) {
        filter.batch = batchRef;
      } else {
        const batchDoc = await Batch.findOne({ slug: batchRef });
        if (batchDoc) filter.batch = batchDoc._id;
      }
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    let courses = await Course.find(filter)
      .populate("batch", "name slug")
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (teacher) {
      const ct = await CourseTeacher.find({ teacher }).select("course").lean();
      const ids = ct.map((c) => c.course);
      courses = courses.filter((c) => ids.some((id) => id.toString() === c._id.toString()));
    }

    if (coordinator) {
      const cc = await CourseCoordinator.find({ coordinator: coordinator }).select("course").lean();
      const ids = cc.map((c) => c.course);
      courses = courses.filter((c) => ids.some((id) => id.toString() === c._id.toString()));
    }

    let enrollmentMap = new Map();
    if (student) {
      const csList = await CourseStudent.find({ student }).select("course completedAt").lean();
      const ids = csList.map((c) => c.course.toString());
      csList.forEach((cs) => enrollmentMap.set(cs.course.toString(), { completedAt: cs.completedAt }));
      courses = courses.filter((c) => ids.includes(c._id.toString()));
    }

    const courseIds = courses.map((c) => c._id);
    const countPipeline = (Model) => [
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: "$course", count: { $sum: 1 } } },
    ];
    const [lectureCounts, studentCounts, teacherCounts, coordinatorCounts] = await Promise.all([
      Lecture.aggregate(countPipeline(Lecture)),
      CourseStudent.aggregate(countPipeline(CourseStudent)),
      CourseTeacher.aggregate(countPipeline(CourseTeacher)),
      CourseCoordinator.aggregate(countPipeline(CourseCoordinator)),
    ]);

    const toMap = (arr) => new Map(arr.map((r) => [r._id.toString(), r.count]));
    const lectureMap = toMap(lectureCounts);
    const studentMap = toMap(studentCounts);
    const teacherMap = toMap(teacherCounts);
    const coordMap = toMap(coordinatorCounts);

    const withCounts = courses.map((c) => {
      const id = c._id.toString();
      const enrollment = enrollmentMap.get(id);
      return {
        ...c,
        lectures: lectureMap.get(id) || 0,
        students: studentMap.get(id) || 0,
        teachers: teacherMap.get(id) || 0,
        coordinators: coordMap.get(id) || 0,
        completedAt: enrollment?.completedAt || null,
      };
    });

    res.json({ courses: withCounts });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/courses — create course (admin+)
const createCourse = async (req, res) => {
  try {
    const { batch, title, description } = req.body;
    if (!batch || !title?.trim()) {
      return res.status(400).json({ message: "Batch and title are required" });
    }

    const slug = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const batchId = typeof batch === "string" && /^[a-fA-F0-9]{24}$/.test(batch)
      ? batch
      : (await Batch.findById(batch))?._id || batch;
    if (!batchId) {
      return res.status(400).json({ message: "Invalid batch" });
    }

    const count = await Course.countDocuments({ batch: batchId });
    const course = await Course.create({
      batch: batchId,
      title: title.trim(),
      slug: slug || `course-${Date.now()}`,
      description: description?.trim() || "",
      order: count,
    });

    // Enroll all active batch students into the new course
    const batchStudents = await BatchStudent.find({ batch: batchId, isActive: true });
    for (const bs of batchStudents) {
      await CourseStudent.findOneAndUpdate(
        { course: course._id, student: bs.student },
        { $setOnInsert: { course: course._id, student: bs.student, enrolledBy: bs.enrolledBy } },
        { upsert: true }
      );
    }

    const populated = await Course.findById(course._id).populate("batch", "name slug");
    res.status(201).json({ course: populated });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/courses/:id
const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("batch", "name slug")
      .lean();
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const [lectureCount, assignmentCount, teachers, coordinators, students] = await Promise.all([
      Lecture.countDocuments({ course: course._id }),
      Assignment.countDocuments({ course: course._id }),
      CourseTeacher.find({ course: course._id }).populate("teacher", "name email avatar").lean(),
      CourseCoordinator.find({ course: course._id }).populate("coordinator", "name email avatar").lean(),
      CourseStudent.find({ course: course._id })
        .select("student enrolledBy completedAt completedBy")
        .populate("student", "name email avatar")
        .populate("completedBy", "name")
        .lean(),
    ]);

    res.json({
      course: {
        ...course,
        lectureCount,
        assignmentCount,
        teachers,
        coordinators,
        students,
      },
    });
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/courses/:id
const updateCourse = async (req, res) => {
  try {
    const { title, description, order, isActive } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (title !== undefined) course.title = title.trim();
    if (description !== undefined) course.description = description.trim();
    if (order !== undefined) course.order = order;
    if (isActive !== undefined) course.isActive = isActive;

    await course.save();
    const populated = await Course.findById(course._id).populate("batch", "name slug");
    res.json({ course: populated });
  } catch (error) {
    console.error("Update course error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/courses/:id/teachers — assign teacher
const assignTeacher = async (req, res) => {
  try {
    const { teacher } = req.body;
    const courseId = req.params.id;

    if (!teacher) {
      return res.status(400).json({ message: "Teacher ID is required" });
    }

    const user = await User.findById(teacher);
    if (!user || user.role !== "teacher") {
      return res.status(400).json({ message: "Invalid teacher" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const existing = await CourseTeacher.findOne({ course: courseId, teacher });
    if (existing) {
      return res.status(400).json({ message: "Teacher is already assigned to this course" });
    }

    const ct = await CourseTeacher.create({
      course: courseId,
      teacher,
      assignedBy: req.user._id,
    });

    const populated = await CourseTeacher.findById(ct._id)
      .populate("teacher", "name email avatar")
      .populate("course", "title slug");
    res.status(201).json({ assignment: populated });
  } catch (error) {
    console.error("Assign teacher error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/courses/:id/teachers/:teacherId
const unassignTeacher = async (req, res) => {
  try {
    const { id: courseId, teacherId } = req.params;
    const deleted = await CourseTeacher.findOneAndDelete({
      course: courseId,
      teacher: teacherId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json({ message: "Teacher unassigned successfully" });
  } catch (error) {
    console.error("Unassign teacher error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/courses/:id/students — enroll student
const enrollStudent = async (req, res) => {
  try {
    const { student } = req.body;
    const courseId = req.params.id;

    if (!student) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    const user = await User.findById(student);
    if (!user || user.role !== "student") {
      return res.status(400).json({ message: "Invalid student" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const existing = await CourseStudent.findOne({ course: courseId, student });
    if (existing) {
      return res.status(400).json({ message: "Student is already enrolled in this course" });
    }

    const cs = await CourseStudent.create({
      course: courseId,
      student,
      enrolledBy: req.user._id,
    });

    const populated = await CourseStudent.findById(cs._id)
      .populate("student", "name email avatar")
      .populate("course", "title slug");
    res.status(201).json({ enrollment: populated });
  } catch (error) {
    console.error("Enroll student error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/courses/:id/students/:studentId
const unenrollStudent = async (req, res) => {
  try {
    const { id: courseId, studentId } = req.params;
    const deleted = await CourseStudent.findOneAndDelete({
      course: courseId,
      student: studentId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Enrollment not found" });
    }
    res.json({ message: "Student unenrolled successfully" });
  } catch (error) {
    console.error("Unenroll student error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/courses/:id/coordinators — assign coordinator
const assignCoordinator = async (req, res) => {
  try {
    const { coordinator } = req.body;
    const courseId = req.params.id;

    if (!coordinator) {
      return res.status(400).json({ message: "Coordinator ID is required" });
    }

    const user = await User.findById(coordinator);
    if (!user || user.role !== "coordinator") {
      return res.status(400).json({ message: "Invalid coordinator" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const existing = await CourseCoordinator.findOne({ course: courseId, coordinator });
    if (existing) {
      return res.status(400).json({ message: "Coordinator is already assigned to this course" });
    }

    const cc = await CourseCoordinator.create({
      course: courseId,
      coordinator,
      assignedBy: req.user._id,
    });

    const populated = await CourseCoordinator.findById(cc._id)
      .populate("coordinator", "name email avatar")
      .populate("course", "title slug");
    res.status(201).json({ assignment: populated });
  } catch (error) {
    console.error("Assign coordinator error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/courses/:id/coordinators/:coordinatorId
const unassignCoordinator = async (req, res) => {
  try {
    const { id: courseId, coordinatorId } = req.params;
    const deleted = await CourseCoordinator.findOneAndDelete({
      course: courseId,
      coordinator: coordinatorId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json({ message: "Coordinator unassigned successfully" });
  } catch (error) {
    console.error("Unassign coordinator error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/courses/:id/students/bulk-complete — mark multiple or all students complete
const bulkMarkCourseComplete = async (req, res) => {
  req.setTimeout(600000); // 10 min for large batches (500+ certificates)
  try {
    const courseId = req.params.id;
    const { studentIds, all } = req.body;

    const isTeacher = await CourseTeacher.findOne({ course: courseId, teacher: req.user._id });
    const isCoord = await CourseCoordinator.findOne({ course: courseId, coordinator: req.user._id });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isCoord && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to mark course complete" });
    }

    const course = await Course.findById(courseId).populate("batch", "name");
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    let toProcess = [];
    if (all) {
      const enrollments = await CourseStudent.find({
        course: courseId,
        completedAt: null,
      }).populate("student", "name email");
      toProcess = enrollments.map((e) => ({
        enrollment: e,
        student: e.student,
      }));
    } else if (Array.isArray(studentIds) && studentIds.length > 0) {
      const enrollments = await CourseStudent.find({
        course: courseId,
        student: { $in: studentIds },
        completedAt: null,
      }).populate("student", "name email");
      toProcess = enrollments.map((e) => ({ enrollment: e, student: e.student }));
    } else {
      return res.status(400).json({ message: "Provide studentIds array or all: true" });
    }

    if (toProcess.length === 0) {
      return res.json({
        message: "No pending students to mark complete",
        completed: 0,
        skipped: 0,
      });
    }

    const results = { completed: 0, skipped: 0, errors: [] };

    for (const { enrollment, student } of toProcess) {
      try {
        const existingCert = await Certificate.findOne({
          student: student._id,
          course: courseId,
        });
        if (existingCert) {
          results.skipped++;
          continue;
        }

        enrollment.completedAt = new Date();
        enrollment.completedBy = req.user._id;
        await enrollment.save();

        await createAndStoreCertificate(student, course, req.user._id);
        results.completed++;
      } catch (err) {
        results.errors.push({ student: student?.name || student?._id, error: err.message });
      }
    }

    res.json({
      message: `Marked ${results.completed} student(s) complete. ${results.skipped} skipped (already had certificate).`,
      ...results,
    });
  } catch (error) {
    console.error("Bulk mark complete error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

// POST /api/courses/:id/students/:studentId/complete — teacher/admin/coordinator only
const markCourseComplete = async (req, res) => {
  try {
    const { id: courseId, studentId } = req.params;
    const isTeacher = await CourseTeacher.findOne({ course: courseId, teacher: req.user._id });
    const isCoord = await CourseCoordinator.findOne({ course: courseId, coordinator: req.user._id });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isCoord && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to mark course complete" });
    }
    const course = await Course.findById(courseId).populate("batch", "name");
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const user = await User.findById(studentId);
    if (!user || user.role !== "student") {
      return res.status(400).json({ message: "Invalid student" });
    }

    const cs = await CourseStudent.findOne({ course: courseId, student: studentId });
    if (!cs) {
      return res.status(404).json({ message: "Student is not enrolled in this course" });
    }
    if (cs.completedAt) {
      return res.status(400).json({ message: "Course already marked as complete for this student" });
    }

    const existingCert = await Certificate.findOne({ student: studentId, course: courseId });
    if (existingCert) {
      return res.status(400).json({ message: "Certificate already exists for this course completion" });
    }

    cs.completedAt = new Date();
    cs.completedBy = req.user._id;
    await cs.save();

    const certificate = await createAndStoreCertificate(
      user,
      course,
      req.user._id
    );

    const populated = await CourseStudent.findById(cs._id)
      .select("student enrolledBy completedAt completedBy")
      .populate("student", "name email avatar")
      .populate("completedBy", "name");

    res.json({
      message: "Course marked as complete. Certificate generated.",
      enrollment: populated,
      certificate: {
        _id: certificate._id,
        certificateId: certificate.certificateId,
        pdfUrl: certificate.pdfUrl,
        issuedAt: certificate.issuedAt,
      },
    });
  } catch (error) {
    console.error("Mark course complete error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

// DELETE /api/courses/:id
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    course.isActive = false;
    await course.save();
    res.json({ message: "Course deactivated successfully" });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getCourses,
  createCourse,
  getCourseById,
  updateCourse,
  assignTeacher,
  unassignTeacher,
  enrollStudent,
  unenrollStudent,
  markCourseComplete,
  bulkMarkCourseComplete,
  assignCoordinator,
  unassignCoordinator,
  deleteCourse,
};
