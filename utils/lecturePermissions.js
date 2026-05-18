const CourseTeacher = require("../models/CourseTeacher");

async function canManageLectureMaterials(user, lecture) {
  if (!user || !lecture) return false;
  if (["superadmin", "admin", "coordinator"].includes(user.role)) return true;
  const isTeacher = await CourseTeacher.findOne({
    course: lecture.course,
    teacher: user._id,
  });
  return Boolean(isTeacher);
}

module.exports = { canManageLectureMaterials };
