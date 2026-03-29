const mongoose = require("mongoose");

const COURSE_TYPES = ["fullstack_developer", "data_analytics"];

const courseIntakeBatchSchema = new mongoose.Schema(
  {
    courseType: {
      type: String,
      required: true,
      enum: COURSE_TYPES,
      index: true,
    },
    displayName: {
      type: String,
      required: [true, "Batch display name is required"],
      trim: true,
      maxlength: 200,
    },
    batchStartDate: {
      type: Date,
      default: null,
    },
    isAcceptingRegistrations: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

courseIntakeBatchSchema.index({ courseType: 1, isActive: 1, isAcceptingRegistrations: 1 });
courseIntakeBatchSchema.index({ batchStartDate: -1 });

module.exports = mongoose.model("CourseIntakeBatch", courseIntakeBatchSchema);
module.exports.COURSE_TYPES = COURSE_TYPES;
