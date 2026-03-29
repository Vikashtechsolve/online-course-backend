const mongoose = require("mongoose");

const courseCoordinatorSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    coordinator: {
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

courseCoordinatorSchema.index({ course: 1, coordinator: 1 }, { unique: true });
courseCoordinatorSchema.index({ coordinator: 1 });

module.exports = mongoose.model("CourseCoordinator", courseCoordinatorSchema);
