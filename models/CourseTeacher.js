const mongoose = require("mongoose");

const courseTeacherSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

courseTeacherSchema.index({ course: 1, teacher: 1 }, { unique: true });
courseTeacherSchema.index({ teacher: 1 });

module.exports = mongoose.model("CourseTeacher", courseTeacherSchema);
