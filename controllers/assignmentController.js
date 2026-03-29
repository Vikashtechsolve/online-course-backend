const Assignment = require("../models/Assignment");
const AssignmentSubmission = require("../models/AssignmentSubmission");
const Course = require("../models/Course");
const CourseTeacher = require("../models/CourseTeacher");
const CourseStudent = require("../models/CourseStudent");
const {
  uploadToR2,
  uploadToLocal,
  isR2Configured,
} = require("../services/uploadService");

const baseUrl = () =>
  process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

async function uploadFile(file, folder) {
  if (!file || !file.buffer) return null;
  try {
    if (isR2Configured()) {
      const result = await uploadToR2(file, folder);
      return result.url;
    }
    const result = await uploadToLocal(file, folder, baseUrl());
    return result.url;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
}

// GET /api/assignments — list assignments
const getAssignments = async (req, res) => {
  try {
    const { course, student } = req.query;
    const filter = {};
    if (course) filter.course = course;

    let assignments = await Assignment.find(filter)
      .populate("course", "title slug batch")
      .populate("assignedBy", "name email")
      .sort({ dueDate: 1 });

    if (student) {
      const submissions = await AssignmentSubmission.find({ student });
      const subMap = new Map(submissions.map((s) => [s.assignment.toString(), s]));
      assignments = assignments.map((a) => {
        const sub = subMap.get(a._id.toString());
        return {
          ...a.toObject(),
          submission: sub
            ? {
                status: sub.status,
                submissionLink: sub.submissionLink,
                submittedAt: sub.submittedAt,
                grade: sub.grade,
              }
            : null,
        };
      });
    }

    res.json({ assignments });
  } catch (error) {
    console.error("Get assignments error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/assignments — create assignment
const createAssignment = async (req, res) => {
  try {
    const { course, title, description, dueDate, estimatedTime } = req.body;

    if (!course || !title?.trim() || !dueDate) {
      return res.status(400).json({ message: "Course, title, and due date are required" });
    }

    const courseDoc = await Course.findById(course);
    if (!courseDoc) {
      return res.status(404).json({ message: "Course not found" });
    }

    const isTeacher = await CourseTeacher.findOne({
      course,
      teacher: req.user._id,
    });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ message: "You are not assigned to this course" });
    }

    let attachmentUrl = "";
    if (req.file) {
      attachmentUrl = await uploadFile(req.file, "assignments") || "";
    }

    const assignment = await Assignment.create({
      course,
      title: title.trim(),
      description: description?.trim() || "",
      assignedBy: req.user._id,
      dueDate: new Date(dueDate),
      estimatedTime: estimatedTime?.trim() || "",
      attachmentUrl,
    });

    const populated = await Assignment.findById(assignment._id)
      .populate("course", "title slug")
      .populate("assignedBy", "name email");
    res.status(201).json({ assignment: populated });
  } catch (error) {
    console.error("Create assignment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/assignments/:id
const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("course", "title slug batch")
      .populate("assignedBy", "name email");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json({ assignment });
  } catch (error) {
    console.error("Get assignment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/assignments/:id
const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const isTeacher = await CourseTeacher.findOne({
      course: assignment.course,
      teacher: req.user._id,
    });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ message: "You are not assigned to this course" });
    }

    const { title, description, dueDate, estimatedTime } = req.body;
    if (title !== undefined) assignment.title = title.trim();
    if (description !== undefined) assignment.description = description.trim();
    if (dueDate !== undefined) assignment.dueDate = new Date(dueDate);
    if (estimatedTime !== undefined) assignment.estimatedTime = estimatedTime.trim();

    if (req.file) {
      assignment.attachmentUrl = await uploadFile(req.file, "assignments") || assignment.attachmentUrl;
    }

    await assignment.save();
    const populated = await Assignment.findById(assignment._id)
      .populate("course", "title slug")
      .populate("assignedBy", "name email");
    res.json({ assignment: populated });
  } catch (error) {
    console.error("Update assignment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/assignments/:id/submit — student submit
const submitAssignment = async (req, res) => {
  try {
    const { submissionLink } = req.body;
    const assignmentId = req.params.id;

    if (!submissionLink?.trim()) {
      return res.status(400).json({ message: "Submission link is required" });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const isStudent = await CourseStudent.findOne({
      course: assignment.course,
      student: req.user._id,
    });
    if (!isStudent && req.user.role !== "student") {
      return res.status(403).json({ message: "You are not enrolled in this course" });
    }

    let sub = await AssignmentSubmission.findOne({
      assignment: assignmentId,
      student: req.user._id,
    });

    if (sub) {
      sub.submissionLink = submissionLink.trim();
      sub.submittedAt = new Date();
      sub.status = "submitted";
      await sub.save();
    } else {
      sub = await AssignmentSubmission.create({
        assignment: assignmentId,
        student: req.user._id,
        submissionLink: submissionLink.trim(),
        submittedAt: new Date(),
        status: "submitted",
      });
    }

    const populated = await AssignmentSubmission.findById(sub._id)
      .populate("assignment", "title course dueDate")
      .populate("student", "name email");
    res.json({ submission: populated });
  } catch (error) {
    console.error("Submit assignment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/assignments/:id/submissions
const getSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const isTeacher = await CourseTeacher.findOne({
      course: assignment.course,
      teacher: req.user._id,
    });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ message: "You are not assigned to this course" });
    }

    const submissions = await AssignmentSubmission.find({ assignment: req.params.id })
      .populate("student", "name email avatar")
      .sort({ submittedAt: -1 });

    res.json({ submissions });
  } catch (error) {
    console.error("Get submissions error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/submissions/:id — grade/feedback (teacher)
const updateSubmission = async (req, res) => {
  try {
    const { grade, feedback } = req.body;
    const sub = await AssignmentSubmission.findById(req.params.id)
      .populate("assignment");

    if (!sub) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const isTeacher = await CourseTeacher.findOne({
      course: sub.assignment.course,
      teacher: req.user._id,
    });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ message: "You cannot grade this submission" });
    }

    if (grade !== undefined) {
      sub.grade = grade;
      sub.status = "graded";
    }
    if (feedback !== undefined) sub.feedback = feedback.trim();
    await sub.save();

    const populated = await AssignmentSubmission.findById(sub._id)
      .populate("assignment", "title course")
      .populate("student", "name email");
    res.json({ submission: populated });
  } catch (error) {
    console.error("Update submission error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAssignments,
  createAssignment,
  getAssignmentById,
  updateAssignment,
  submitAssignment,
  getSubmissions,
  updateSubmission,
};
