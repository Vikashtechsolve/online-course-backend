const User = require("../models/User");
const Course = require("../models/Course");
const Assignment = require("../models/Assignment");
const Announcement = require("../models/Announcement");
const Lecture = require("../models/Lecture");
const SupportTicket = require("../models/SupportTicket");
const CourseTeacher = require("../models/CourseTeacher");
const CourseCoordinator = require("../models/CourseCoordinator");

const ACTIVITY_LIMIT = 18;
const FETCH_EACH_FULL = 12;
const FETCH_EACH_SCOPED = 24;

async function getStaffCourseScope(userId, role) {
  if (role === "teacher") {
    return CourseTeacher.distinct("course", { teacher: userId });
  }
  if (role === "coordinator") {
    return CourseCoordinator.distinct("course", { coordinator: userId });
  }
  return [];
}

function pushActivity(bucket, at, title, color, type) {
  if (!at) return;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return;
  bucket.push({ at: new Date(at).toISOString(), title, color, type });
}

/**
 * GET /api/admin/dashboard — counts + recent cross-entity activity
 */
exports.getAdminDashboard = async (req, res) => {
  try {
    const [
      totalCourses,
      totalStudents,
      totalTeachers,
      openTickets,
      totalAssignments,
      upcomingLectureCount,
    ] = await Promise.all([
      Course.countDocuments({ isActive: true }),
      User.countDocuments({ role: "student", isActive: true }),
      User.countDocuments({ role: "teacher", isActive: true }),
      SupportTicket.countDocuments({ status: "open" }),
      Assignment.countDocuments(),
      Lecture.countDocuments({
        status: { $in: ["upcoming", "live"] },
        scheduledAt: { $ne: null },
      }),
    ]);

    const stats = [
      {
        key: "courses",
        title: "Total Courses",
        value: String(totalCourses),
        icon: "courses",
      },
      {
        key: "students",
        title: "Total Students",
        value: String(totalStudents),
        icon: "students",
      },
      {
        key: "teachers",
        title: "Total Teachers",
        value: String(totalTeachers),
        icon: "teachers",
      },
      {
        key: "openTickets",
        title: "Open Support Tickets",
        value: String(openTickets),
        icon: "tickets",
      },
      {
        key: "assignments",
        title: "Assignments",
        value: String(totalAssignments),
        icon: "assignments",
      },
      {
        key: "upcomingLectures",
        title: "Upcoming / live lectures",
        value: String(upcomingLectureCount),
        icon: "lectures",
      },
    ];

    const role = req.user.role;
    const isFullAccess = role === "superadmin" || role === "admin";

    let activityCourseFilter = null;
    let ticketCourseTitles = null;
    const fetchLimit = isFullAccess ? FETCH_EACH_FULL : FETCH_EACH_SCOPED;

    if (!isFullAccess && (role === "teacher" || role === "coordinator")) {
      const courseIds = await getStaffCourseScope(req.user._id, role);
      if (courseIds.length === 0) {
        activityCourseFilter = { course: { $in: [] } };
        ticketCourseTitles = [];
      } else {
        activityCourseFilter = { course: { $in: courseIds } };
        const titles = await Course.find({ _id: { $in: courseIds } })
          .select("title")
          .lean();
        ticketCourseTitles = titles.map((c) => c.title).filter(Boolean);
      }
    }

    const announcementQ = Announcement.find(
      isFullAccess ? {} : activityCourseFilter || {}
    )
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .populate("course", "title")
      .lean();

    const assignmentQ = Assignment.find(
      isFullAccess ? {} : activityCourseFilter || {}
    )
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .populate("course", "title")
      .lean();

    const lectureBase = { scheduledAt: { $ne: null } };
    const lectureQ = Lecture.find(
      isFullAccess ? lectureBase : { ...lectureBase, ...(activityCourseFilter || {}) }
    )
      .sort({ scheduledAt: -1 })
      .limit(fetchLimit)
      .populate("course", "title")
      .lean();

    let ticketQ;
    if (isFullAccess) {
      ticketQ = SupportTicket.find({ status: "resolved" })
        .sort({ updatedAt: -1 })
        .limit(fetchLimit)
        .lean();
    } else if (ticketCourseTitles && ticketCourseTitles.length > 0) {
      ticketQ = SupportTicket.find({
        status: "resolved",
        course: { $in: ticketCourseTitles },
      })
        .sort({ updatedAt: -1 })
        .limit(fetchLimit)
        .lean();
    } else {
      ticketQ = Promise.resolve([]);
    }

    const [recentAnnouncements, recentAssignments, recentLectures, recentResolvedTickets] =
      await Promise.all([announcementQ, assignmentQ, lectureQ, ticketQ]);

    const activities = [];

    for (const a of recentAnnouncements) {
      const courseTitle = a.course?.title ? ` — ${a.course.title}` : "";
      pushActivity(
        activities,
        a.createdAt,
        `Announcement: ${a.title}${courseTitle}`,
        "green",
        "announcement"
      );
    }

    for (const a of recentAssignments) {
      const courseTitle = a.course?.title ? ` (${a.course.title})` : "";
      pushActivity(
        activities,
        a.createdAt,
        `Assignment added: ${a.title}${courseTitle}`,
        "blue",
        "assignment"
      );
    }

    for (const lec of recentLectures) {
      const courseTitle = lec.course?.title ? ` (${lec.course.title})` : "";
      const prefix =
        lec.status === "live"
          ? "Live session"
          : lec.status === "upcoming"
            ? "Lecture scheduled"
            : "Lecture";
      pushActivity(
        activities,
        lec.scheduledAt || lec.createdAt,
        `${prefix}: ${lec.title}${courseTitle}`,
        "purple",
        "lecture"
      );
    }

    for (const t of recentResolvedTickets) {
      pushActivity(
        activities,
        t.updatedAt,
        `Support ticket resolved: ${t.title}`,
        "red",
        "ticket"
      );
    }

    activities.sort((x, y) => new Date(y.at) - new Date(x.at));
    const trimmed = activities.slice(0, ACTIVITY_LIMIT);

    res.json({
      stats,
      activities: trimmed,
      headline: {
        title: "Dashboard Overview",
        subtitle: isFullAccess
          ? "Here's a quick snapshot of what's happening across the platform."
          : "Recent updates for your courses and related support activity.",
      },
    });
  } catch (err) {
    console.error("getAdminDashboard:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
