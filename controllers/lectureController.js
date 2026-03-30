const Lecture = require("../models/Lecture");
const LectureDiscussion = require("../models/LectureDiscussion");
const Course = require("../models/Course");
const CourseTeacher = require("../models/CourseTeacher");
const CourseStudent = require("../models/CourseStudent");
const { uploadFileAndGetUrl } = require("../services/uploadService");
const { transcodeAndUploadHLS } = require("../services/hlsService");

// GET /api/lectures/today — today's lectures for a student (single query)
const getTodayLectures = async (req, res) => {
  try {
    const { student } = req.query;
    if (!student) {
      return res.status(400).json({ message: "student query param is required" });
    }

    const enrollments = await CourseStudent.find({ student }).select("course").lean();
    const courseIds = enrollments.map((e) => e.course);
    if (courseIds.length === 0) {
      return res.json({ lectures: [] });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const lectures = await Lecture.find({
      course: { $in: courseIds },
      scheduledAt: { $gte: todayStart, $lt: tomorrowStart },
    })
      .populate("course", "title slug")
      .populate("teacher", "name email avatar")
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({ lectures });
  } catch (error) {
    console.error("Get today lectures error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/lectures — list lectures (filter by course)
const getLectures = async (req, res) => {
  try {
    const { course, status } = req.query;
    const filter = {};
    if (course) filter.course = course;
    if (status) filter.status = status;

    const lectures = await Lecture.find(filter)
      .populate("course", "title slug batch")
      .populate("teacher", "name email avatar")
      .sort({ order: 1, scheduledAt: 1 })
      .lean();

    res.json({ lectures });
  } catch (error) {
    console.error("Get lectures error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/lectures — create lecture
const createLecture = async (req, res) => {
  try {
    const { course, title, scheduledAt, duration, status, meetingLink, testLink, practiceContent } = req.body;

    if (!course || !title?.trim()) {
      return res.status(400).json({ message: "Course and title are required" });
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

    const count = await Lecture.countDocuments({ course });
    const lecture = await Lecture.create({
      course,
      title: title.trim(),
      teacher: req.user._id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      duration: duration ? parseInt(duration, 10) : null,
      status: status || "draft",
      meetingLink: meetingLink?.trim() || "",
      testLink: testLink?.trim() || "",
      practiceContent: practiceContent?.trim() || "",
      order: count,
    });

    const populated = await Lecture.findById(lecture._id)
      .populate("course", "title slug")
      .populate("teacher", "name email avatar");
    res.status(201).json({ lecture: populated });
  } catch (error) {
    console.error("Create lecture error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/lectures/:id
const getLectureById = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id)
      .populate("course", "title slug batch")
      .populate("teacher", "name email avatar")
      .lean();

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    res.json({ lecture });
  } catch (error) {
    console.error("Get lecture error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/lectures/:id
const updateLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const isTeacher = await CourseTeacher.findOne({
      course: lecture.course,
      teacher: req.user._id,
    });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ message: "You are not assigned to this course" });
    }

    const allowed = [
      "title", "scheduledAt", "duration", "status",
      "meetingLink", "videoUrl", "testLink", "practiceContent",
      "notes", "ppt", "order",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "scheduledAt") lecture.scheduledAt = req.body[key] ? new Date(req.body[key]) : null;
        else if (key === "duration") lecture.duration = req.body[key] ? parseInt(req.body[key], 10) : null;
        else if (key === "notes" && typeof req.body.notes === "object") {
          if (req.body.notes.image !== undefined) lecture.notes.image = req.body.notes.image;
          if (req.body.notes.pdf !== undefined) lecture.notes.pdf = req.body.notes.pdf;
        } else if (key === "ppt" && typeof req.body.ppt === "object") {
          if (Array.isArray(req.body.ppt.slides)) lecture.ppt.slides = req.body.ppt.slides;
          if (req.body.ppt.fileUrl !== undefined) lecture.ppt.fileUrl = req.body.ppt.fileUrl || "";
        } else if (key !== "notes" && key !== "ppt") {
          lecture[key] = req.body[key];
        }
      }
    }

    await lecture.save();
    const populated = await Lecture.findById(lecture._id)
      .populate("course", "title slug")
      .populate("teacher", "name email avatar");
    res.json({ lecture: populated });
  } catch (error) {
    console.error("Update lecture error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/lectures/:id/upload — upload materials (video, notes, ppt)
const uploadLectureMaterials = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const isTeacher = await CourseTeacher.findOne({
      course: lecture.course,
      teacher: req.user._id,
    });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ message: "You are not assigned to this course" });
    }

    const updates = {};

    if (req.files?.video?.[0]) {
      const videoFile = req.files.video[0];
      const hlsUrl = await transcodeAndUploadHLS(videoFile.buffer, String(lecture._id));
      updates.videoUrl = hlsUrl || (await uploadFileAndGetUrl(videoFile, "lectures/videos")) || lecture.videoUrl;
    }
    if (req.files?.notesPdf?.[0]) {
      updates["notes.pdf"] = await uploadFileAndGetUrl(req.files.notesPdf[0], "lectures/notes") || lecture.notes?.pdf;
    }
    if (req.files?.pptFile?.[0]) {
      updates["ppt.fileUrl"] =
        (await uploadFileAndGetUrl(req.files.pptFile[0], "lectures/ppt")) ||
        lecture.ppt?.fileUrl ||
        "";
    }

    if (Object.keys(updates).length) {
      await Lecture.findByIdAndUpdate(lecture._id, { $set: updates });
    }

    const updated = await Lecture.findById(lecture._id)
      .populate("course", "title slug")
      .populate("teacher", "name email avatar");
    res.json({ lecture: updated });
  } catch (error) {
    console.error("Upload lecture materials error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/lectures/:id
const deleteLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const isTeacher = await CourseTeacher.findOne({
      course: lecture.course,
      teacher: req.user._id,
    });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ message: "You are not assigned to this course" });
    }

    await Lecture.findByIdAndDelete(lecture._id);
    await LectureDiscussion.deleteMany({ lecture: lecture._id });
    res.json({ message: "Lecture deleted successfully" });
  } catch (error) {
    console.error("Delete lecture error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/lectures/:id/discussions
const getDiscussions = async (req, res) => {
  try {
    const discussions = await LectureDiscussion.find({ lecture: req.params.id })
      .populate("user", "name email avatar")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ discussions });
  } catch (error) {
    console.error("Get discussions error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/lectures/:id/discussions
const createDiscussion = async (req, res) => {
  try {
    const { text } = req.body;
    const lectureId = req.params.id;

    if (!text?.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const isStudent = await CourseStudent.findOne({
      course: lecture.course,
      student: req.user._id,
    });
    const isTeacher = await CourseTeacher.findOne({
      course: lecture.course,
      teacher: req.user._id,
    });
    const isAdmin = ["superadmin", "admin", "coordinator"].includes(req.user.role);
    if (!isStudent && !isTeacher && !isAdmin) {
      return res.status(403).json({ message: "You do not have access to this lecture" });
    }

    const discussion = await LectureDiscussion.create({
      lecture: lectureId,
      user: req.user._id,
      text: text.trim(),
    });

    const populated = await LectureDiscussion.findById(discussion._id)
      .populate("user", "name email avatar");
    res.status(201).json({ discussion: populated });
  } catch (error) {
    console.error("Create discussion error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getTodayLectures,
  getLectures,
  createLecture,
  getLectureById,
  updateLecture,
  uploadLectureMaterials,
  deleteLecture,
  getDiscussions,
  createDiscussion,
};
