const Announcement = require("../models/Announcement");
const Course = require("../models/Course");
const CourseCoordinator = require("../models/CourseCoordinator");
const CourseStudent = require("../models/CourseStudent");
const CourseTeacher = require("../models/CourseTeacher");
const AnnouncementRead = require("../models/AnnouncementRead");
const AnnouncementStaffRead = require("../models/AnnouncementStaffRead");

/** Mongo filter for announcements visible to staff, or { empty: true } if none, or {} for all courses (admin/superadmin). */
async function staffAnnouncementCourseFilter(req) {
  if (!["superadmin", "admin", "coordinator", "teacher"].includes(req.user.role)) {
    return null;
  }
  if (req.user.role === "coordinator") {
    const links = await CourseCoordinator.find({ coordinator: req.user._id }).select("course");
    const ids = links.map((l) => l.course);
    if (ids.length === 0) return { empty: true };
    return { course: { $in: ids } };
  }
  if (req.user.role === "teacher") {
    const links = await CourseTeacher.find({ teacher: req.user._id }).select("course");
    const ids = links.map((l) => l.course);
    if (ids.length === 0) return { empty: true };
    return { course: { $in: ids } };
  }
  return {};
}

async function userCanManageCourse(user, courseId) {
  if (["superadmin", "admin"].includes(user.role)) return true;
  if (user.role === "coordinator") {
    const assigned = await CourseCoordinator.findOne({
      course: courseId,
      coordinator: user._id,
    });
    return !!assigned;
  }
  if (user.role === "teacher") {
    const assigned = await CourseTeacher.findOne({
      course: courseId,
      teacher: user._id,
    });
    return !!assigned;
  }
  return false;
}

// GET /api/announcements — students: enrolled courses; staff: managed courses
const listAnnouncements = async (req, res) => {
  try {
    const { course: courseFilter } = req.query;

    if (req.user.role === "student") {
      const enrollments = await CourseStudent.find({ student: req.user._id }).select("course");
      const courseIds = enrollments.map((e) => e.course);
      const filter = { course: { $in: courseIds } };
      if (courseFilter && /^[a-fA-F0-9]{24}$/.test(courseFilter)) {
        if (!courseIds.some((id) => id.toString() === courseFilter)) {
          return res.json({ announcements: [] });
        }
        filter.course = courseFilter;
      }
      const announcements = await Announcement.find(filter)
        .populate({ path: "course", select: "title slug", populate: { path: "batch", select: "name" } })
        .populate("author", "name")
        .sort({ createdAt: -1 })
        .lean();
      const announcementIds = announcements.map((a) => a._id);
      const readRows = await AnnouncementRead.find({
        student: req.user._id,
        announcement: { $in: announcementIds },
      }).select("announcement");
      const readSet = new Set(readRows.map((r) => r.announcement.toString()));
      const withReadFlags = announcements.map((a) => ({
        ...a,
        isRead: readSet.has(a._id.toString()),
      }));
      const unreadCount = withReadFlags.reduce((acc, a) => acc + (a.isRead ? 0 : 1), 0);
      return res.json({ announcements: withReadFlags, unreadCount });
    }

    if (!["superadmin", "admin", "coordinator", "teacher"].includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    let allowedCourseIds = null;
    if (req.user.role === "coordinator") {
      const links = await CourseCoordinator.find({ coordinator: req.user._id }).select("course");
      allowedCourseIds = links.map((l) => l.course.toString());
      if (allowedCourseIds.length === 0) {
        return res.json({ announcements: [] });
      }
    }
    if (req.user.role === "teacher") {
      const links = await CourseTeacher.find({ teacher: req.user._id }).select("course");
      allowedCourseIds = links.map((l) => l.course.toString());
      if (allowedCourseIds.length === 0) {
        return res.json({ announcements: [] });
      }
    }

    const filter = {};
    if (allowedCourseIds) {
      filter.course = { $in: allowedCourseIds };
    }
    if (courseFilter && /^[a-fA-F0-9]{24}$/.test(courseFilter)) {
      if (allowedCourseIds && !allowedCourseIds.includes(courseFilter)) {
        return res.status(403).json({ message: "Not authorized for this course" });
      }
      filter.course = courseFilter;
    }

    const announcements = await Announcement.find(filter)
      .populate({
        path: "course",
        select: "title slug batch",
        populate: { path: "batch", select: "name slug" },
      })
      .populate("author", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const announcementIds = announcements.map((a) => a._id);
    const readRows = await AnnouncementStaffRead.find({
      user: req.user._id,
      announcement: { $in: announcementIds },
    }).select("announcement");
    const readSet = new Set(readRows.map((r) => r.announcement.toString()));
    const withReadFlags = announcements.map((a) => ({
      ...a,
      isRead: readSet.has(a._id.toString()),
    }));
    const unreadCount = withReadFlags.reduce((acc, a) => acc + (a.isRead ? 0 : 1), 0);

    return res.json({ announcements: withReadFlags, unreadCount });
  } catch (error) {
    console.error("List announcements error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/announcements/unread-count — students + staff (admin/coordinator/teacher)
const getUnreadAnnouncementsCount = async (req, res) => {
  try {
    if (req.user.role === "student") {
      const enrollments = await CourseStudent.find({ student: req.user._id }).select("course");
      const courseIds = enrollments.map((e) => e.course);
      if (courseIds.length === 0) {
        return res.json({ unreadCount: 0 });
      }
      const announcements = await Announcement.find({ course: { $in: courseIds } }).select("_id");
      const announcementIds = announcements.map((a) => a._id);
      if (announcementIds.length === 0) {
        return res.json({ unreadCount: 0 });
      }
      const readCount = await AnnouncementRead.countDocuments({
        student: req.user._id,
        announcement: { $in: announcementIds },
      });
      return res.json({ unreadCount: Math.max(announcementIds.length - readCount, 0) });
    }

    if (["superadmin", "admin", "coordinator", "teacher"].includes(req.user.role)) {
      const base = await staffAnnouncementCourseFilter(req);
      if (!base || base.empty) {
        return res.json({ unreadCount: 0 });
      }
      const query = Object.keys(base).length > 0 ? base : {};
      const announcements = await Announcement.find(query).select("_id");
      const announcementIds = announcements.map((a) => a._id);
      if (announcementIds.length === 0) {
        return res.json({ unreadCount: 0 });
      }
      const readCount = await AnnouncementStaffRead.countDocuments({
        user: req.user._id,
        announcement: { $in: announcementIds },
      });
      return res.json({ unreadCount: Math.max(announcementIds.length - readCount, 0) });
    }

    return res.json({ unreadCount: 0 });
  } catch (error) {
    console.error("Unread announcement count error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/announcements/mark-read — students (enrolled courses) + staff (visible courses)
const markAnnouncementsRead = async (req, res) => {
  try {
    const { announcementIds } = req.body || {};
    if (!Array.isArray(announcementIds) || announcementIds.length === 0) {
      return res.status(400).json({ message: "announcementIds array is required" });
    }

    if (req.user.role === "student") {
      const enrollments = await CourseStudent.find({ student: req.user._id }).select("course");
      const courseIds = enrollments.map((e) => e.course);
      const allowedAnnouncements = await Announcement.find({
        _id: { $in: announcementIds },
        course: { $in: courseIds },
      }).select("_id");

      const operations = allowedAnnouncements.map((a) => ({
        updateOne: {
          filter: { announcement: a._id, student: req.user._id },
          update: { $set: { readAt: new Date() } },
          upsert: true,
        },
      }));

      if (operations.length > 0) {
        await AnnouncementRead.bulkWrite(operations);
      }

      return res.json({ marked: operations.length });
    }

    if (["superadmin", "admin", "coordinator", "teacher"].includes(req.user.role)) {
      const base = await staffAnnouncementCourseFilter(req);
      if (!base || base.empty) {
        return res.json({ marked: 0 });
      }
      const query = { _id: { $in: announcementIds } };
      if (Object.keys(base).length > 0) {
        Object.assign(query, base);
      }
      const allowedAnnouncements = await Announcement.find(query).select("_id");

      const operations = allowedAnnouncements.map((a) => ({
        updateOne: {
          filter: { announcement: a._id, user: req.user._id },
          update: { $set: { readAt: new Date() } },
          upsert: true,
        },
      }));

      if (operations.length > 0) {
        await AnnouncementStaffRead.bulkWrite(operations);
      }

      return res.json({ marked: operations.length });
    }

    return res.status(403).json({ message: "Not authorized" });
  } catch (error) {
    console.error("Mark announcement read error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { course: courseId, title, body } = req.body;
    if (!courseId || !title?.trim() || !body?.trim()) {
      return res.status(400).json({ message: "Course, title, and body are required" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const allowed = await userCanManageCourse(req.user, courseId);
    if (!allowed) {
      return res.status(403).json({ message: "You are not allowed to post announcements for this course" });
    }

    const announcement = await Announcement.create({
      course: courseId,
      title: title.trim(),
      body: body.trim(),
      author: req.user._id,
    });

    if (["superadmin", "admin", "coordinator", "teacher"].includes(req.user.role)) {
      await AnnouncementStaffRead.updateOne(
        { announcement: announcement._id, user: req.user._id },
        { $set: { readAt: new Date() } },
        { upsert: true }
      );
    }

    const populated = await Announcement.findById(announcement._id)
      .populate({
        path: "course",
        select: "title slug batch",
        populate: { path: "batch", select: "name slug" },
      })
      .populate("author", "name email")
      .lean();

    res.status(201).json({ announcement: populated });
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/announcements/:id
const updateAnnouncement = async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ message: "Title and body are required" });
    }

    const ann = await Announcement.findById(req.params.id);
    if (!ann) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    if (["coordinator", "teacher"].includes(req.user.role)) {
      const isAuthor = ann.author.toString() === req.user._id.toString();
      if (!isAuthor) {
        return res.status(403).json({ message: "Not authorized to edit this announcement" });
      }
    } else if (!["superadmin", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    ann.title = title.trim();
    ann.body = body.trim();
    await ann.save();

    const populated = await Announcement.findById(ann._id)
      .populate({
        path: "course",
        select: "title slug batch",
        populate: { path: "batch", select: "name slug" },
      })
      .populate("author", "name email")
      .lean();

    return res.json({ announcement: populated });
  } catch (error) {
    console.error("Update announcement error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/announcements/:id
const deleteAnnouncement = async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    if (["superadmin", "admin"].includes(req.user.role)) {
      await Announcement.deleteOne({ _id: ann._id });
      return res.json({ message: "Deleted" });
    }

    if (["coordinator", "teacher"].includes(req.user.role)) {
      const isAuthor = ann.author.toString() === req.user._id.toString();
      if (!isAuthor) {
        return res.status(403).json({ message: "Not authorized to delete this announcement" });
      }
      await Announcement.deleteOne({ _id: ann._id });
      return res.json({ message: "Deleted" });
    }

    return res.status(403).json({ message: "Not authorized" });
  } catch (error) {
    console.error("Delete announcement error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listAnnouncements,
  getUnreadAnnouncementsCount,
  markAnnouncementsRead,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
